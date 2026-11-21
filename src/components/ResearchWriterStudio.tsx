import React, { useState } from 'react';
import {
  ListTree,
  PenTool,
  Copy,
  Check,
  Download,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  FileEdit,
  Building2,
} from 'lucide-react';
import {
  generateResearchOutlineWithGemini,
  draftHumanizedPaperWithGemini,
  ExecutionMetadata,
} from '../services/geminiClient';
import { downloadTextFile } from '../utils/exporter';
import HumanContributionMeter from './HumanContributionMeter';
import StrategicAuditChapterStudio from './StrategicAuditChapterStudio';

interface ResearchWriterStudioProps {
  onSendToAnalyzer: (draftText: string) => void;
}

export const ResearchWriterStudio: React.FC<ResearchWriterStudioProps> = ({
  onSendToAnalyzer,
}) => {
  const [writerMode, setWriterMode] = useState<'general' | 'strategic_audit'>('general');
  const [title, setTitle] = useState('');
  const [outline, setOutline] = useState('');
  const [generatedOutlineBaseline, setGeneratedOutlineBaseline] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [draftPaper, setDraftPaper] = useState('');
  const [outlineEngine, setOutlineEngine] = useState<ExecutionMetadata | null>(null);
  const [draftEngine, setDraftEngine] = useState<ExecutionMetadata | null>(null);

  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isDraftingPaper, setIsDraftingPaper] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPaper, setCopiedPaper] = useState(false);

  const safeTitle = typeof title === 'string' ? title : '';
  const safeOutline = typeof outline === 'string' ? outline : '';
  const safeBaseline =
    typeof generatedOutlineBaseline === 'string' ? generatedOutlineBaseline : '';
  const safePersonalNotes = typeof personalNotes === 'string' ? personalNotes : '';
  const safeDraftPaper = typeof draftPaper === 'string' ? draftPaper : '';

  const outlineModified = safeBaseline.trim()
    ? safeOutline.trim().length > 0 && safeOutline.trim() !== safeBaseline.trim()
    : safeOutline.trim().length >= 20;

  const paperWordCount = safeDraftPaper.trim()
    ? safeDraftPaper.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeTitle.trim() || isGeneratingOutline || isDraftingPaper) return;

    setErrorMessage(null);
    setIsGeneratingOutline(true);

    try {
      const result = await generateResearchOutlineWithGemini(safeTitle.trim());
      setOutline(result.text || '');
      setGeneratedOutlineBaseline(result.text || '');
      setOutlineEngine({
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
      });
      setDraftPaper('');
      setDraftEngine(null);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'تعذر توليد المخطط البحثي. يرجى المحاولة مجدداً.');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleDraftPaper = async () => {
    if (!safeOutline.trim() || isGeneratingOutline || isDraftingPaper) return;

    setErrorMessage(null);
    setIsDraftingPaper(true);

    try {
      const result = await draftHumanizedPaperWithGemini({
        title: safeTitle.trim() || undefined,
        outline: safeOutline.trim(),
        personalNotes: safePersonalNotes.trim() || undefined,
      });
      setDraftPaper(result.text || '');
      setDraftEngine({
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
      });

      setTimeout(() => {
        document.getElementById('drafted-paper-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 250);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'تعذر كتابة الورقة البحثية. يرجى المحاولة مجدداً.');
    } finally {
      setIsDraftingPaper(false);
    }
  };

  const handleCopyPaper = () => {
    if (!safeDraftPaper) return;
    navigator.clipboard.writeText(safeDraftPaper);
    setCopiedPaper(true);
    setTimeout(() => setCopiedPaper(false), 2000);
  };

  const handleDownloadPaper = () => {
    if (!safeDraftPaper) return;
    const safeName = (safeTitle || 'research-paper')
      .slice(0, 35)
      .replace(/[\s/\\?%*:|"<>]/g, '_');
    downloadTextFile(safeDraftPaper, `${safeName}.md`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-mode selector inside Research Writer Studio */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-2 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => setWriterMode('general')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 ${
            writerMode === 'general'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <PenTool className="w-4 h-4 text-teal-400" />
          <span>ورقة بحثية عامة (مخطط قابل للتعديل + مسودة)</span>
        </button>
        <button
          type="button"
          onClick={() => setWriterMode('strategic_audit')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 ${
            writerMode === 'strategic_audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>تقرير تدقيق استراتيجي جامعي (فصل بفصل ~45 صفحة)</span>
        </button>
      </div>

      {writerMode === 'strategic_audit' ? (
        <StrategicAuditChapterStudio onSendToAnalyzer={onSendToAnalyzer} />
      ) : (
        <>
      {/* Step 1: Research Title -> Editable Outline */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-teal-300 flex items-center justify-center">
              <ListTree className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                الخطوة 1: تخطيط البحث وتوليد المخطط القابل للتعديل
              </h3>
              <p className="text-xs text-slate-500">
                أدخل عنوان البحث (بالعربية أو الإنجليزية) لتوليد هيكل تحليلي موجز مع مواضع لإضافة رؤيتك الشخصية
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            نفس لغة العنوان تلقائياً
          </span>
        </div>

        <form onSubmit={handleGenerateOutline} className="space-y-3">
          <div>
            <label htmlFor="research-title-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              عنوان البحث المقترح:
            </label>
            <input
              id="research-title-input"
              type="text"
              dir="auto"
              value={safeTitle}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: أثر التحول الرقمي على كفاءة الأداء المؤسسي في الجامعات السعودية — أو عنوان بالإنجليزية"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isGeneratingOutline || isDraftingPaper || safeTitle.trim().length < 5}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-teal-900 disabled:opacity-40 text-white text-sm font-bold transition inline-flex items-center gap-2"
            >
              {isGeneratingOutline ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري بناء المخطط البحثي...</span>
                </>
              ) : (
                <>
                  <ListTree className="w-4 h-4 text-teal-300" />
                  <span>توليد المخطط القابل للتعديل</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <b className="font-bold block">تعذر إتمام الطلب</b>
            <p className="text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Step 2: Edit Outline & Inject Personal Notes -> Draft Human-Style Paper */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                الخطوة 2: عدّل المخطط وأضف ملاحظاتك ثم صُغ الورقة الكاملة
              </h3>
              <p className="text-xs text-slate-500">
                عدّل الأقسام واستبدل مواضع الملاحظات بأمثلتك وبياناتك، لتُكتب الورقة بأسلوب أكاديمي بشري متنوع الجمل وخالٍ من القوالب الآلية
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <label htmlFor="editable-outline-area" className="block text-xs font-bold text-slate-700">
                المخطط البحثي (قابل للتعديل المباشر):
              </label>
              {outlineEngine && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                    outlineEngine.providerUsed === 'openai'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  }`}
                >
                  المحرك الفعلي:{' '}
                  {outlineEngine.providerUsed === 'openai' ? 'OpenAI GPT' : 'Gemini'} (
                  {outlineEngine.modelUsed})
                </span>
              )}
            </div>
            <textarea
              id="editable-outline-area"
              dir="auto"
              value={safeOutline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="سيظهر المخطط البحثي هنا بعد الخطوة 1، أو يمكنك لصق مخططك وتعديله مباشرة..."
              className="w-full min-h-[260px] p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
            />
          </div>

          <div>
            <label htmlFor="personal-notes-area" className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات الباحث، الأمثلة المحلية، والبيانات المراد دمجها (اختياري):
            </label>
            <textarea
              id="personal-notes-area"
              dir="auto"
              value={safePersonalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="أضف هنا أرقاماً ميدانية، أمثلة محلية من بيئة دراستك، مراجع تود الاستشهاد بها، أو رأيك الشخصي في كل محور..."
              className="w-full min-h-[110px] p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition resize-y"
            />
            <HumanContributionMeter
              notesText={safePersonalNotes}
              outlineModified={outlineModified}
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleDraftPaper}
              disabled={isDraftingPaper || isGeneratingOutline || safeOutline.trim().length < 20}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-900 hover:from-slate-800 hover:to-teal-800 disabled:opacity-40 text-white text-sm sm:text-base font-bold transition inline-flex items-center justify-center gap-2.5 shadow-lg shadow-teal-950/15"
            >
              {isDraftingPaper ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري صياغة الورقة البحثية بأسلوب أكاديمي طبيعي...</span>
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4 text-teal-300" />
                  <span>كتابة الورقة البحثية النهائية</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Drafted Paper Result */}
      {safeDraftPaper && (
        <div
          id="drafted-paper-section"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  المسودة النهائية للبحث الأكاديمي
                </h3>
                {draftEngine && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      draftEngine.providerUsed === 'openai'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {draftEngine.providerUsed === 'openai' ? 'OpenAI GPT' : 'Gemini'} •{' '}
                    {draftEngine.modelUsed}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                {paperWordCount.toLocaleString()} كلمة · صياغة أكاديمية متماسكة مبنية على مخططك وملاحظاتك
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyPaper}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                {copiedPaper ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>نسخ النص</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadPaper}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تحميل (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToAnalyzer(safeDraftPaper)}
                className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <span>تحليل أو فحص AI للنص</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            dir="auto"
            className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/80 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
          >
            {safeDraftPaper}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
