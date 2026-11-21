import React, { useState, useEffect } from 'react';
import {
  Building2,
  BookOpenCheck,
  Copy,
  Check,
  Download,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Layers,
  Sparkles,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  generateStrategicAuditChapterWithGemini,
  ExecutionMetadata,
} from '../services/geminiClient';
import { downloadTextFile } from '../utils/exporter';
import HumanContributionMeter from './HumanContributionMeter';

interface ChapterBlueprint {
  id: number;
  title: string;
  pages: string;
  promptFocus: string;
}

const CHAPTERS: ChapterBlueprint[] = [
  {
    id: 1,
    title: 'الفصل 1: الملخص التنفيذي والمقدمة والرؤية',
    pages: '~6-7 صفحات',
    promptFocus:
      'Write Executive Summary (max 2 pages), Company Introduction, Corporate Governance overview, and Vision/Mission evaluation using Fred David’s 9-component Framework.',
  },
  {
    id: 2,
    title: 'الفصل 2: التحليل الخارجي (PESTEL, Porter, EFE, CPM)',
    pages: '~10-12 صفحة',
    promptFocus:
      'Write comprehensive General Environment (PESTEL), Industry & Competitor Analysis, Porter’s Five Forces, and External Factor Evaluation (EFE) & Competitive Profile Matrix (CPM) tables with justified weights, ratings, and weighted scores.',
  },
  {
    id: 3,
    title: 'الفصل 3: التحليل الداخلي والأداء المالي (BCG, IFE)',
    pages: '~9-10 صفحات',
    promptFocus:
      'Write 3-year Financial Performance & Ratios (Liquidity, Leverage, Activity, Profitability, Growth), Value Chain Analysis, David’s Functional Audit, BCG Portfolio Matrix, and Internal Factor Evaluation (IFE) Matrix.',
  },
  {
    id: 4,
    title: 'الفصل 4: صياغة الاستراتيجيات والمفاضلة (SWOT, SPACE, QSPM)',
    pages: '~8-9 صفحات',
    promptFocus:
      'Write Strategy Formulation using TOWS/SWOT, SPACE Matrix (FP, CP, SP, IP axes), Internal-External (IE) Matrix, Grand Strategy Matrix, and Quantitative Strategic Planning Matrix (QSPM) prioritization strictly consistent with Chapters 2 & 3 EFE/IFE factors.',
  },
  {
    id: 5,
    title: 'الفصل 5: التوصيات وخطط التنفيذ والمالية والمراجع',
    pages: '~9-10 صفحات',
    promptFocus:
      'Write 3-to-5-year SMART Strategic & Financial Objectives, Functional Action Plans (Marketing, Finance, Operations, HR, R&D), Balanced Scorecard KPIs, Risk Mitigation, and complete APA References.',
  },
];

interface StrategicAuditChapterStudioProps {
  onSendToAnalyzer: (draftText: string) => void;
}

function buildAutoPreviousContext(
  chapterOutputs: Record<number, string>,
  activeChapterId: number
): string {
  const previousEntries = Object.entries(chapterOutputs)
    .filter(([id, text]) => Number(id) < activeChapterId && typeof text === 'string' && text.trim())
    .sort(([a], [b]) => Number(a) - Number(b));

  if (previousEntries.length === 0) return '';

  return previousEntries
    .map(([id, text]) => {
      const chObj = CHAPTERS.find((c) => c.id === Number(id));

      // استخراج الأسطر الخاصة بالأرقام والجداول والمصفوفات والأوزان والتقييمات فقط
      const metricLines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            (line.startsWith('|') ||
              /\d+(\.\d+)?%|\$|\b(EFE|IFE|CPM|SWOT|SPACE|BCG|QSPM|IE|ROE|ROA|ROI|EPS|P\/E|WACC|Total|Score|Weight|Rating|Revenue|Profit|Margin)\b/i.test(
                line
              ))
        );

      const rawDigest =
        metricLines.length > 0
          ? metricLines.join('\n')
          : text.replace(/\s+/g, ' ').trim();

      // حد أقصى صارم ~300 كلمة لكل فصل سابق لتسريع التوليد
      const cappedWords = rawDigest.split(/\s+/).filter(Boolean).slice(0, 300).join(' ');
      return `[Chapter ${id} Metrics/Matrices — ${chObj?.title || ''}]:\n${cappedWords}`;
    })
    .join('\n\n');
}

export const StrategicAuditChapterStudio: React.FC<StrategicAuditChapterStudioProps> = ({
  onSendToAnalyzer,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState<'auto' | 'en' | 'ar'>('auto');
  const [companyDataAndRubric, setCompanyDataAndRubric] = useState('');
  const [globalResearcherNotes, setGlobalResearcherNotes] = useState('');

  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [chapterNotes, setChapterNotes] = useState<Record<number, string>>({});
  const [chapterOutputs, setChapterOutputs] = useState<Record<number, string>>({});
  const [chapterEngines, setChapterEngines] = useState<Record<number, ExecutionMetadata>>({});
  const [manualPrevContextOverride, setManualPrevContextOverride] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedChapter, setCopiedChapter] = useState(false);
  const [copiedFullReport, setCopiedFullReport] = useState(false);

  useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(0);
    const intervalId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isGenerating]);

  const currentChapterObj =
    CHAPTERS.find((c) => c.id === activeChapter) || CHAPTERS[0];

  const safeCompanyName = typeof companyName === 'string' ? companyName : '';
  const safeRubric = typeof companyDataAndRubric === 'string' ? companyDataAndRubric : '';
  const safeGlobalNotes = typeof globalResearcherNotes === 'string' ? globalResearcherNotes : '';
  const safeCurrentChapterNotes =
    typeof chapterNotes[activeChapter] === 'string' ? chapterNotes[activeChapter] : '';
  const safeManualContext =
    typeof manualPrevContextOverride === 'string' ? manualPrevContextOverride : '';

  const currentOutput =
    typeof chapterOutputs[activeChapter] === 'string' ? chapterOutputs[activeChapter] : '';

  const combinedNotes = [safeGlobalNotes.trim(), safeCurrentChapterNotes.trim()]
    .filter(Boolean)
    .join('\n\n');

  const autoPreviousContext = buildAutoPreviousContext(chapterOutputs, activeChapter);
  const effectivePreviousContext = [autoPreviousContext, safeManualContext.trim()]
    .filter(Boolean)
    .join('\n\n');

  const countWords = (text: string) =>
    typeof text === 'string' && text.trim()
      ? text.trim().split(/\s+/).filter(Boolean).length
      : 0;

  const currentChapterWordCount = countWords(currentOutput);

  const completedChaptersList = CHAPTERS.filter(
    (ch) => typeof chapterOutputs[ch.id] === 'string' && chapterOutputs[ch.id].trim().length > 0
  );
  const totalCompiledWords = completedChaptersList.reduce(
    (sum, ch) => sum + countWords(chapterOutputs[ch.id] || ''),
    0
  );
  const estimatedPages = totalCompiledWords > 0 ? Math.max(1, Math.round(totalCompiledWords / 350)) : 0;

  const handleGenerateCurrentChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeCompanyName.trim() || isGenerating) return;

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const result = await generateStrategicAuditChapterWithGemini({
        companyName: safeCompanyName.trim(),
        targetChapter: currentChapterObj.title,
        chapterInstructions: currentChapterObj.promptFocus,
        companyDataAndRubric: safeRubric.trim() || undefined,
        researcherNotes: combinedNotes || undefined,
        previousChaptersContext: effectivePreviousContext || undefined,
        language,
      });

      setChapterOutputs((prev) => ({
        ...prev,
        [activeChapter]: result.text || '',
      }));
      setChapterEngines((prev) => ({
        ...prev,
        [activeChapter]: {
          providerUsed: result.providerUsed,
          modelUsed: result.modelUsed,
        },
      }));

      setTimeout(() => {
        document.getElementById('audit-chapter-result')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 250);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'تعذر توليد الفصل الاستراتيجي. يرجى المحاولة مجدداً.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getCompiledMarkdown = () => {
    const header = `# Strategic Audit Report: ${safeCompanyName.trim() || 'Target Organization'}\n\n`;
    const body = CHAPTERS.filter(
      (ch) => typeof chapterOutputs[ch.id] === 'string' && chapterOutputs[ch.id].trim().length > 0
    )
      .map((ch) => chapterOutputs[ch.id].trim())
      .join('\n\n---\n\n');
    return header + body;
  };

  const handleCopyCurrentChapter = () => {
    if (!currentOutput) return;
    navigator.clipboard.writeText(currentOutput);
    setCopiedChapter(true);
    setTimeout(() => setCopiedChapter(false), 2000);
  };

  const handleDownloadCurrentChapter = () => {
    if (!currentOutput) return;
    const cleanCompany = (safeCompanyName || 'company')
      .slice(0, 25)
      .replace(/[\s/\\?%*:|"<>]/g, '_');
    downloadTextFile(currentOutput, `${cleanCompany}_Chapter_${activeChapter}.md`);
  };

  const handleDeleteCurrentChapterOutput = () => {
    setChapterOutputs((prev) => {
      const next = { ...prev };
      delete next[activeChapter];
      return next;
    });
    setChapterEngines((prev) => {
      const next = { ...prev };
      delete next[activeChapter];
      return next;
    });
  };

  const handleCopyFullReport = () => {
    if (completedChaptersList.length === 0) return;
    navigator.clipboard.writeText(getCompiledMarkdown());
    setCopiedFullReport(true);
    setTimeout(() => setCopiedFullReport(false), 2000);
  };

  const handleDownloadFullReport = () => {
    if (completedChaptersList.length === 0) return;
    const cleanCompany = (safeCompanyName || 'strategic-audit-report')
      .slice(0, 35)
      .replace(/[\s/\\?%*:|"<>]/g, '_');
    downloadTextFile(getCompiledMarkdown(), `${cleanCompany}_Full_Strategic_Audit_Report.md`);
  };

  return (
    <div className="space-y-6">
      {/* Global Company & Rubric Card */}
      <form
        onSubmit={handleGenerateCurrentChapter}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-teal-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                بنّاء تقرير التدقيق الاستراتيجي متعدد الفصول (نحو 45 صفحة)
              </h3>
              <p className="text-xs text-slate-500">
                اختر الفصل، أضف ملاحظاتك الخاصة به، ويقوم النظام بتمرير ملخصات الفصول السابقة تلقائياً لضمان اتساق الأوزان والأرقام المالية
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
            <Sparkles className="w-3.5 h-3.5" />
            <span>David’s Framework • EFE • IFE • CPM • QSPM</span>
          </span>
        </div>

        {/* Company Name & Language */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="audit-company-name"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              اسم الشركة أو المؤسسة المستهدفة: *
            </label>
            <input
              id="audit-company-name"
              type="text"
              dir="auto"
              value={safeCompanyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="مثال: شركة أرامكو السعودية / شركة المراعي / Apple Inc."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition"
            />
          </div>

          <div>
            <label
              htmlFor="audit-language"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              لغة كتابة الفصول:
            </label>
            <select
              id="audit-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'auto' | 'en' | 'ar')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition"
            >
              <option value="auto">تلقائي حسب لغة المدخلات</option>
              <option value="en">الإنجليزية الأكاديمية (English)</option>
              <option value="ar">العربية الأكاديمية (Arabic)</option>
            </select>
          </div>
        </div>

        {/* Company Financials & Rubric */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="audit-rubric-data"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              بيانات الشركة المالية + معايير التكليف (Assignment Guidelines & Rubric):
            </label>
            <textarea
              id="audit-rubric-data"
              dir="auto"
              value={safeRubric}
              onChange={(e) => setCompanyDataAndRubric(e.target.value)}
              placeholder="الصق هنا الأرقام المالية لـ 3 سنوات، المنافسين، الحصة السوقية، وإرشادات الأستاذ أو معايير التقييم..."
              className="w-full min-h-[110px] p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
            />
          </div>

          <div>
            <label
              htmlFor="audit-global-notes"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              ملاحظات الباحث العامة وافتراضات التقرير المشتركة:
            </label>
            <textarea
              id="audit-global-notes"
              dir="auto"
              value={safeGlobalNotes}
              onChange={(e) => setGlobalResearcherNotes(e.target.value)}
              placeholder="أفكار عامة، أمثلة محلية، أو افتراضات مالية تريد تثبيتها في كافة فصول التقرير..."
              className="w-full min-h-[110px] p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
            />
          </div>
        </div>

        {/* 5-Chapter Interactive Step Selector */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700">
              خريطة الفصول الخمسة للتقرير الاستراتيجي (اختر الفصل للعمل عليه):
            </span>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {completedChaptersList.length} / {CHAPTERS.length} فصول مكتملة · ~{estimatedPages} / 45 صفحة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {CHAPTERS.map((ch) => {
              const isSelected = ch.id === activeChapter;
              const isDone = Boolean(
                typeof chapterOutputs[ch.id] === 'string' && chapterOutputs[ch.id].trim()
              );
              const chWords = countWords(chapterOutputs[ch.id] || '');

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setActiveChapter(ch.id);
                    setErrorMessage(null);
                  }}
                  className={`text-right p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : isDone
                        ? 'bg-emerald-50/80 text-slate-900 border-emerald-200 hover:border-emerald-400'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-teal-500/20 text-teal-300'
                          : isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {ch.pages}
                    </span>
                    {isDone && (
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                      />
                    )}
                  </div>

                  <p className="text-xs font-bold leading-snug line-clamp-2">{ch.title}</p>

                  {isDone && (
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <span
                        className={`text-[11px] tabular-nums ${
                          isSelected ? 'text-slate-300' : 'text-emerald-700'
                        }`}
                      >
                        {chWords.toLocaleString()} كلمة
                      </span>
                      {chapterEngines[ch.id] && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-slate-800 text-teal-300'
                              : chapterEngines[ch.id].providerUsed === 'openai'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {chapterEngines[ch.id].providerUsed === 'openai' ? 'GPT' : 'Gemini'}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Chapter Details, Auto-Context & Per-Chapter Notes */}
        <div className="rounded-xl bg-slate-50/80 border border-slate-200/90 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                <span>{currentChapterObj.title}</span>
              </h4>
              <p className="text-xs text-slate-600 mt-1" dir="auto">
                نطاق الفصل المطلوب: {currentChapterObj.promptFocus}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              الطول المستهدف: {currentChapterObj.pages}
            </span>
          </div>

          {activeChapter > 1 && (
            <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    الربط التلقائي مع الفصول السابقة (الفصول 1 إلى {activeChapter - 1}):
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-teal-700">
                  {autoPreviousContext
                    ? 'تم التقاط ملخصات وجداول الفصول السابقة تلقائياً'
                    : 'لم تُولد فصول سابقة بعد — يمكنك إضافة أرقامها يدوياً أدناه'}
                </span>
              </div>
              <textarea
                dir="auto"
                value={safeManualContext}
                onChange={(e) => setManualPrevContextOverride(e.target.value)}
                placeholder="اختياري: أضف هنا أي أرقام أو نتائج إضافية من فصول سابقة مكتوبة خارج الأداة (مثل: EFE = 2.85, IFE = 2.94)..."
                className="w-full min-h-[65px] p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="audit-chapter-notes"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              ملاحظات الباحث الخاصة بـ «{currentChapterObj.title}» والأمثلة المحلية:
            </label>
            <textarea
              id="audit-chapter-notes"
              dir="auto"
              value={safeCurrentChapterNotes}
              onChange={(e) =>
                setChapterNotes((prev) => ({
                  ...prev,
                  [activeChapter]: e.target.value,
                }))
              }
              placeholder={`أضف ملاحظاتك وأمثلتك وافتراضاتك الخاصة بالفصل ${activeChapter} هنا لخفض بصمة AI...`}
              className="w-full min-h-[105px] p-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
            />
            <HumanContributionMeter
              notesText={combinedNotes}
              outlineModified={Boolean(safeRubric.trim() || effectivePreviousContext.trim())}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isGenerating || safeCompanyName.trim().length < 2}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-900 hover:from-slate-800 hover:to-teal-800 disabled:opacity-40 text-white text-sm sm:text-base font-bold transition inline-flex items-center justify-center gap-2.5 shadow-lg shadow-teal-950/15"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="tabular-nums">
                  جاري صياغة الفصل {activeChapter}... {elapsedSeconds}s
                </span>
              </>
            ) : (
              <>
                <BookOpenCheck className="w-5 h-5 text-teal-300" />
                <span>
                  {currentOutput
                    ? `إعادة توليد ${currentChapterObj.title}`
                    : `توليد ${currentChapterObj.title}`}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <b className="font-bold block">تعذر توليد الفصل</b>
            <p className="text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Active Chapter Generated Output */}
      {currentOutput && (
        <div
          id="audit-chapter-result"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {currentChapterObj.title}
                </h3>
                {chapterEngines[activeChapter] && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      chapterEngines[activeChapter].providerUsed === 'openai'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    المحرك الفعلي:{' '}
                    {chapterEngines[activeChapter].providerUsed === 'openai'
                      ? 'OpenAI GPT'
                      : 'Gemini'}{' '}
                    ({chapterEngines[activeChapter].modelUsed})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                {currentChapterWordCount.toLocaleString()} كلمة · محفوظ تلقائياً ضمن الفصول المجمّعة
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyCurrentChapter}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                {copiedChapter ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>نسخ الفصل</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadCurrentChapter}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تحميل الفصل (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToAnalyzer(currentOutput)}
                className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <span>فحص AI أو تحليل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDeleteCurrentChapterOutput}
                aria-label="حذف مسودة الفصل الحالي"
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            dir="auto"
            className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/80 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
          >
            {currentOutput}
          </div>
        </div>
      )}

      {/* Compiled Multi-Chapter Report (~45 Pages Tracker) */}
      {completedChaptersList.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-400" />
                <span>
                  التقرير الاستراتيجي المجمّع ({completedChaptersList.length} / {CHAPTERS.length} فصول)
                </span>
              </h3>
              <p className="text-xs text-slate-300 tabular-nums mt-0.5">
                إجمالي الكلمات: {totalCompiledWords.toLocaleString()} كلمة · التقدير: ~{estimatedPages} صفحة من أصل 45 صفحة
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyFullReport}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                {copiedFullReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">تم نسخ التقرير</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ التقرير الكامل</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadFullReport}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل التقرير المجمّع (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToAnalyzer(getCompiledMarkdown())}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <span>تحليل التقرير الكامل</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((completedChaptersList.length / CHAPTERS.length) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategicAuditChapterStudio;
