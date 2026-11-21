import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { InputTabs } from './components/InputTabs';
import { AnalysisControls } from './components/AnalysisControls';
import { ResultsOverview } from './components/ResultsOverview';
import { ExecutiveSummarySection } from './components/ExecutiveSummarySection';
import { MethodologySection } from './components/MethodologySection';
import { FindingsSection } from './components/FindingsSection';
import { StrengthsAndWeaknessesSection } from './components/StrengthsAndWeaknessesSection';
import { DefenseQuestionsSection } from './components/DefenseQuestionsSection';
import { ActionPlanSection } from './components/ActionPlanSection';
import { PaperChatDrawer } from './components/PaperChatDrawer';
import { SavedLibraryModal } from './components/SavedLibraryModal';
import { KeyPage } from './components/KeyPage';
import {
  analyzeResearchWithGemini,
  getStoredApiKey,
  saveApiKey,
} from './services/geminiClient';
import {
  analyzeResearchWithOpenAI,
  getStoredOpenAiKey,
  saveOpenAiKey,
} from './services/openaiClient';
import {
  AnalysisResult,
  AnalysisMode,
  SavedResearch,
} from './types/research';
import { ExtractResult, InlineFileData } from './utils/pdfExtractor';
import { calculateTextMetrics } from './utils/textStats';
import {
  getSavedResearches,
  saveResearch,
  deleteSavedResearch,
} from './utils/storage';
import {
  formatFullReportAsMarkdown,
  downloadTextFile,
} from './utils/exporter';
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  Key,
} from 'lucide-react';

export default function App() {
  const [text, setText] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<ExtractResult | null>(null);
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'upload' | 'link'>('paste');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('full');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStepText, setLoadingStepText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [lastAnalysisProvider, setLastAnalysisProvider] = useState<'openai' | 'gemini'>('openai');
  const [lastAnalyzedText, setLastAnalyzedText] = useState<string>('');
  const [lastAnalyzedInlineData, setLastAnalyzedInlineData] = useState<InlineFileData | undefined>(
    undefined
  );
  const [savedList, setSavedList] = useState<SavedResearch[]>([]);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);
  const [isCurrentSaved, setIsCurrentSaved] = useState<boolean>(false);
  const [geminiKey, setGeminiKey] = useState<string>(() => getStoredApiKey());
  const [openAiKey, setOpenAiKey] = useState<string>(() => getStoredOpenAiKey());
  const [isKeyPage, setIsKeyPage] = useState<boolean>(() => window.location.hash === '#/key');

  // Load saved list on mount & listen to hash navigation
  useEffect(() => {
    const loaded = getSavedResearches();
    setSavedList(loaded);

    const handleHashChange = () => {
      setIsKeyPage(window.location.hash === '#/key');
      setGeminiKey(getStoredApiKey());
      setOpenAiKey(getStoredOpenAiKey());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const revokePreviewUrl = (file: ExtractResult | null) => {
    if (file?.inlineData?.previewUrl) {
      try {
        URL.revokeObjectURL(file.inlineData.previewUrl);
      } catch {
        // ignore
      }
    }
  };

  const openKeyPage = () => {
    window.location.hash = '#/key';
    setIsKeyPage(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeKeyPage = () => {
    window.location.hash = '';
    setIsKeyPage(false);
    setGeminiKey(getStoredApiKey());
    setOpenAiKey(getStoredOpenAiKey());
  };

  const handleSaveKeys = (keys: { openaiKey?: string; geminiKey?: string }) => {
    if (keys.openaiKey) {
      saveOpenAiKey(keys.openaiKey);
      setOpenAiKey(keys.openaiKey.trim());
    }
    if (keys.geminiKey) {
      saveApiKey(keys.geminiKey);
      setGeminiKey(keys.geminiKey.trim());
    }
    if (errorMessage) setErrorMessage(null);
  };

  const currentProvider: 'openai' | 'gemini' = activeInputTab === 'upload' ? 'gemini' : 'openai';

  const canAnalyze =
    currentProvider === 'gemini'
      ? Boolean(uploadedFile && (uploadedFile.inlineData || uploadedFile.text.trim().length >= 30))
      : text.trim().length >= 40;

  const activeTextForMetrics = lastAnalyzedText || (currentProvider === 'gemini' ? uploadedFile?.text || '' : text);
  const metrics = calculateTextMetrics(activeTextForMetrics);

  const missingRequiredKey =
    (currentProvider === 'gemini' && !geminiKey.trim()) ||
    (currentProvider === 'openai' && !openAiKey.trim());

  // Analysis function (Separately routes Paste/Link -> OpenAI GPT-4o, Upload -> Gemini)
  const handleAnalyze = async () => {
    if (!canAnalyze || isLoading) return;

    if (currentProvider === 'gemini' && !geminiKey.trim()) {
      setErrorMessage(
        'لم يتم إدخال مفتاح Gemini API (GEMINI_API_KEY) بعد. افتح صفحة المفاتيح لإدخاله وحفظه لتحليل الملفات والصور.'
      );
      return;
    }

    if (currentProvider === 'openai' && !openAiKey.trim()) {
      setErrorMessage(
        'لم يتم إدخال مفتاح OpenAI API (OPENAI_API_KEY) بعد. افتح صفحة المفاتيح لإدخاله وحفظه لتحليل النصوص عبر GPT-4o.'
      );
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setIsCurrentSaved(false);

    const steps =
      currentProvider === 'gemini'
        ? [
            'جاري قراءة الملف أو الصورة مباشرة عبر Gemini...',
            'تفكيك المنهجية وتحليل الفرضيات والعينة...',
            'فحص النتائج الإحصائية ونقاط القوة والضعف...',
            'صياغة بنك أسئلة المناقشة والدفاع الأكاديمي...',
          ]
        : [
            'جاري استقراء النص الأكاديمي مباشرة عبر GPT-4o...',
            'تفكيك المنهجية وتحليل الفرضيات والعينة...',
            'فحص النتائج الإحصائية ونقاط القوة والضعف...',
            'صياغة بنك أسئلة المناقشة والدفاع الأكاديمي...',
          ];

    let stepIndex = 0;
    setLoadingStepText(steps[0]);

    const interval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingStepText(steps[stepIndex]);
    }, 2400);

    try {
      let analysis: AnalysisResult;

      if (currentProvider === 'gemini' && uploadedFile) {
        analysis = await analyzeResearchWithGemini(
          uploadedFile.text,
          analysisMode,
          geminiKey,
          uploadedFile.inlineData
        );
        setLastAnalysisProvider('gemini');
        setLastAnalyzedText(uploadedFile.text);
        setLastAnalyzedInlineData(uploadedFile.inlineData);
      } else {
        analysis = await analyzeResearchWithOpenAI(text, analysisMode, openAiKey);
        setLastAnalysisProvider('openai');
        setLastAnalyzedText(text);
        setLastAnalyzedInlineData(undefined);
      }

      setAnalysisResult(analysis);

      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 300);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(
        error.message || 'تعذر استكمال التحليل. يرجى التأكد من صحة المفتاح والاتصال والمحاولة مجدداً.'
      );
    } finally {
      clearInterval(interval);
      setIsLoading(false);
      setLoadingStepText('');
    }
  };

  // Reset to new analysis
  const handleReset = () => {
    setText('');
    revokePreviewUrl(uploadedFile);
    setUploadedFile(null);
    setAnalysisResult(null);
    setLastAnalyzedText('');
    setLastAnalyzedInlineData(undefined);
    setErrorMessage(null);
    setIsCurrentSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save current research
  const handleSaveCurrent = () => {
    if (!analysisResult) return;
    const rawToSave =
      lastAnalyzedText ||
      (uploadedFile ? uploadedFile.text || `[ملف/صورة: ${uploadedFile.fileName}]` : text);

    const title =
      prompt(
        'اكتب عنواناً أو اسماً مميزاً لهذا البحث في مكتبتك:',
        analysisResult.titleSuggestion || rawToSave.slice(0, 45).replace(/\n/g, ' ')
      ) || (analysisResult.titleSuggestion || 'بحث محفوظ');

    const saved = saveResearch(
      title,
      rawToSave,
      analysisResult,
      metrics.words,
      metrics.readingTimeMinutes
    );

    setSavedList((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
    setIsCurrentSaved(true);
  };

  // Open saved item
  const handleOpenSavedItem = (item: SavedResearch) => {
    setText(item.rawText);
    setActiveInputTab('paste');
    setAnalysisResult(item.analysis);
    setLastAnalysisProvider('openai');
    setLastAnalyzedText(item.rawText);
    setLastAnalyzedInlineData(undefined);
    setIsCurrentSaved(true);
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 200);
  };

  // Delete saved item
  const handleDeleteSavedItem = (id: string) => {
    const updated = deleteSavedResearch(id);
    setSavedList(updated);
  };

  // Download Markdown report
  const handleDownloadReport = () => {
    if (!analysisResult) return;
    const md = formatFullReportAsMarkdown(analysisResult, activeTextForMetrics.length);
    const filename = `${(analysisResult.titleSuggestion || 'تقرير-التحليل-الأكاديمي')
      .slice(0, 30)
      .replace(/[\s/\\?%*:|"<>]/g, '_')}.md`;
    downloadTextFile(md, filename);
  };

  // Copy full report text
  const handleCopyAll = () => {
    if (!analysisResult) return;
    const md = formatFullReportAsMarkdown(analysisResult, activeTextForMetrics.length);
    navigator.clipboard.writeText(md);
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Navbar */}
      <Navbar
        savedCount={savedList.length}
        onOpenSaved={() => setIsSavedModalOpen(true)}
        onReset={() => {
          closeKeyPage();
          handleReset();
        }}
        hasResults={!!analysisResult}
        onPrint={handlePrint}
        onOpenKeyPage={openKeyPage}
        hasApiKey={Boolean(openAiKey.trim() || geminiKey.trim())}
        isKeyPage={isKeyPage}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {isKeyPage ? (
          <KeyPage
            hasOpenAiKey={Boolean(openAiKey.trim())}
            hasGeminiKey={Boolean(geminiKey.trim())}
            onSaveKeys={handleSaveKeys}
            onBack={closeKeyPage}
          />
        ) : (
          <>
            {/* Hero Section */}
            <div className="text-center space-y-3 pt-2 pb-4 no-print">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-teal-300 text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
                <span>تحليل مزدوج المحرك: GPT-4o للنصوص • Gemini للملفات والصور</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                محلل الأبحاث والدراسات العلمية
              </h2>

              <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                الصق بحثك (GPT-4o)، أو ارفع ملف PDF / Word / TXT أو صورة (Gemini): نستخرج لك
                الملخص التنفيذي، نفكك المنهجية والعينات، نرصد نقاط القوة والضعف، ونحاكي أسئلة لجنة
                المناقشة الأكاديمية.
              </p>
            </div>

            {/* Input & Upload Controls */}
            <div className="space-y-4 no-print">
              <InputTabs
                text={text}
                onChangeText={(val) => {
                  setText(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onClearText={() => {
                  setText('');
                  if (lastAnalysisProvider === 'openai') {
                    setAnalysisResult(null);
                  }
                }}
                uploadedFile={uploadedFile}
                onFileProcessed={(res) => {
                  revokePreviewUrl(uploadedFile);
                  setUploadedFile(res);
                  if (errorMessage) setErrorMessage(null);
                }}
                onClearFile={() => {
                  revokePreviewUrl(uploadedFile);
                  setUploadedFile(null);
                  if (lastAnalysisProvider === 'gemini') {
                    setAnalysisResult(null);
                  }
                }}
                activeInputTab={activeInputTab}
                setActiveInputTab={(tab) => {
                  setActiveInputTab(tab);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <AnalysisControls
                mode={analysisMode}
                onChangeMode={setAnalysisMode}
                onAnalyze={handleAnalyze}
                isLoading={isLoading}
                canAnalyze={canAnalyze}
                loadingStepText={loadingStepText}
                provider={currentProvider}
              />
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start justify-between gap-3 shadow-xs animate-shake no-print flex-wrap">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <b className="font-bold block">تعذر إكمال التحليل الأكاديمي</b>
                    <p className="text-rose-700 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
                {missingRequiredKey && (
                  <button
                    type="button"
                    onClick={openKeyPage}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-teal-900 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>الذهاب إلى صفحة المفاتيح</span>
                  </button>
                )}
              </div>
            )}

            {/* Loading Card with academic skeleton */}
            {isLoading && (
              <div className="bg-white rounded-2xl border border-teal-200 p-8 text-center space-y-4 shadow-md no-print">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {loadingStepText ||
                      (currentProvider === 'gemini'
                        ? 'جاري تحليل الملف أو الصورة عبر Gemini...'
                        : 'جاري تحليل البحث الأكاديمي عبر GPT-4o...')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    نقوم بفحص المنهجية، استخراج النتائج الكمية والنوعية، وصياغة الردود الدفاعية...
                  </p>
                </div>
                <div className="max-w-md mx-auto w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-indigo-600 h-full w-2/3 animate-pulse rounded-full"></div>
                </div>
              </div>
            )}

            {/* Analysis Results View */}
            {analysisResult && (
              <div id="results-section" className="space-y-6 pt-2">
                {/* Overview & Score Card */}
                <ResultsOverview
                  analysis={analysisResult}
                  wordCount={metrics.words}
                  readingTime={metrics.readingTimeMinutes}
                  sentencesCount={metrics.sentences}
                />

                {/* Executive Summary & Goal */}
                <ExecutiveSummarySection
                  summary={analysisResult.summary}
                  goal={analysisResult.goal}
                />

                {/* Methodology Breakdown */}
                <MethodologySection
                  methodology={analysisResult.methodology}
                  type={analysisResult.type}
                />

                {/* Key Findings */}
                <FindingsSection findings={analysisResult.findings} />

                {/* Strengths & Weaknesses Critique */}
                <StrengthsAndWeaknessesSection
                  strengths={analysisResult.strengths}
                  weaknesses={analysisResult.weaknesses}
                />

                {/* Defense Questions Simulator */}
                <DefenseQuestionsSection questions={analysisResult.questions} />

                {/* Action Plan & Elevator Pitch & Toolbar */}
                <ActionPlanSection
                  actionPlan={analysisResult.actionPlan}
                  presentationPitch={analysisResult.presentationPitch}
                  onSave={handleSaveCurrent}
                  onDownload={handleDownloadReport}
                  onCopyAll={handleCopyAll}
                  onPrint={handlePrint}
                  isSaved={isCurrentSaved}
                />

                {/* Interactive Paper AI Chat Drawer */}
                <PaperChatDrawer
                  key={`${analysisResult.titleSuggestion}-${lastAnalysisProvider}`}
                  researchText={lastAnalyzedText}
                  paperTitle={analysisResult.titleSuggestion || 'هذا البحث'}
                  provider={lastAnalysisProvider}
                  openAiKey={openAiKey}
                  geminiKey={geminiKey}
                  inlineData={lastAnalyzedInlineData}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500 space-y-1 no-print">
        <p className="font-semibold text-slate-700">
          محلل الأبحاث الأكاديمية الذكي • مدعوم بنماذج GPT-4o و Google Gemini
        </p>
        <p className="text-slate-400">
          هذا التحليل مساعد أكاديمي واستشاري ذكي. يُرجى دائماً مراجعة النص الأصلي والمراجع التوثيقية قبل الاعتماد النهائي.
        </p>
      </footer>

      {/* Saved Library Modal */}
      <SavedLibraryModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedList={savedList}
        onOpenItem={handleOpenSavedItem}
        onDeleteItem={handleDeleteSavedItem}
      />
    </div>
  );
}
