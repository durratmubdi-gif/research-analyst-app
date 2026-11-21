import React, { useRef, useState } from 'react';
import {
  FileText,
  UploadCloud,
  Link2,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SAMPLE_RESEARCHES, SampleResearch } from '../data/sampleResearches';
import { extractTextFromFile, ExtractResult } from '../utils/pdfExtractor';

interface InputTabsProps {
  text: string;
  onChangeText: (val: string) => void;
  onClearText: () => void;
  uploadedFile: ExtractResult | null;
  onFileProcessed: (res: ExtractResult) => void;
  onClearFile: () => void;
  activeInputTab: 'paste' | 'upload' | 'link';
  setActiveInputTab: (tab: 'paste' | 'upload' | 'link') => void;
}

export const InputTabs: React.FC<InputTabsProps> = ({
  text,
  onChangeText,
  onClearText,
  uploadedFile,
  onFileProcessed,
  onClearFile,
  activeInputTab,
  setActiveInputTab,
}) => {
  const [fileProgress, setFileProgress] = useState<{ status: string; percent?: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showSamplesDropdown, setShowSamplesDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setShowExtractedPreview(false);
    setFileProgress({ status: 'جاري فتح الملف...', percent: 5 });

    try {
      const res = await extractTextFromFile(file, (status, percent) => {
        setFileProgress({ status, percent });
      });

      onFileProcessed(res);
      setFileProgress(null);
    } catch (err: unknown) {
      const error = err as Error;
      setFileError(error.message || 'فشل استخراج محتوى الملف');
      setFileProgress(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearUploaded = () => {
    setFileError(null);
    setFileProgress(null);
    setShowExtractedPreview(false);
    onClearFile();
  };

  const handleUseUrlAndPaste = () => {
    setActiveInputTab('paste');
  };

  const handleSelectSample = (sample: SampleResearch) => {
    onChangeText(sample.content);
    setShowSamplesDropdown(false);
    setActiveInputTab('paste');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden no-print">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-1.5 flex-wrap items-center">
        <button
          type="button"
          onClick={() => setActiveInputTab('paste')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeInputTab === 'paste'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>لصق نص البحث</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeInputTab === 'paste'
                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            GPT-4o
          </span>
          {wordCount > 0 && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeInputTab === 'paste'
                  ? 'bg-teal-700 text-teal-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {wordCount.toLocaleString()} كلمة
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveInputTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeInputTab === 'upload'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>رفع ملف (PDF / TXT / DOCX / صور)</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeInputTab === 'upload'
                ? 'bg-teal-400/20 text-teal-200 border border-teal-400/30'
                : 'bg-teal-50 text-teal-800 border border-teal-200'
            }`}
          >
            Gemini
          </span>
          {uploadedFile && (
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveInputTab('link')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeInputTab === 'link'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>تحليل عبر رابط</span>
        </button>

        {/* Quick Sample Selector */}
        <div className="mr-auto relative">
          <button
            type="button"
            onClick={() => setShowSamplesDropdown(!showSamplesDropdown)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>نماذج أبحاث جاهزة</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showSamplesDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-scale-in">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                اختر دراسة لتجربة التحليل الفوري (GPT-4o)
              </div>
              {SAMPLE_RESEARCHES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSample(s)}
                  className="w-full text-right px-3.5 py-2.5 hover:bg-teal-50 transition text-xs border-b border-slate-50 last:border-0"
                >
                  <p className="font-bold text-slate-800 line-clamp-1">{s.name}</p>
                  <p className="text-[11px] text-teal-700 mt-0.5 font-medium">{s.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-4 sm:p-5">
        {/* 1. Paste Tab -> OpenAI GPT-4o */}
        {activeInputTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs bg-amber-50/70 border border-amber-200/70 text-amber-900 rounded-xl px-3.5 py-2">
              <span className="font-semibold">
                🟠 وضع لصق النص يستخدم مفتاح OpenAI لتحليل البحث عبر نموذج <b>GPT-4o</b>
              </span>
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
                placeholder="الصق هنا نص البحث كاملاً أو أجزاء منه: المقدمة، مشكلة الدراسة، المنهجية والعينة، أدوات جمع البيانات، النتائج الرئيسية، والتوصيات..."
                className="w-full min-h-[200px] sm:min-h-[240px] p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 text-sm leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition placeholder:text-slate-400 resize-y"
              />

              {text && (
                <button
                  type="button"
                  onClick={onClearText}
                  title="مسح النص"
                  className="absolute left-3 top-3 p-1.5 rounded-lg bg-white/90 border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span>
                  عدد الكلمات:{' '}
                  <b className="text-slate-800 font-mono font-bold">
                    {wordCount.toLocaleString()}
                  </b>
                </span>
                <span>•</span>
                <span>
                  عدد الأحرف:{' '}
                  <b className="text-slate-800 font-mono font-bold">
                    {charCount.toLocaleString()}
                  </b>
                </span>
                {wordCount > 0 && wordCount < 40 && (
                  <span className="text-amber-600 font-medium">
                    (نوصي بإدخال فقرة كاملة أو ملخص بحث للحصول على نتائج دقيقة)
                  </span>
                )}
              </div>

              {text && (
                <button
                  type="button"
                  onClick={onClearText}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  مسح النص
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Upload Tab -> Gemini */}
        {activeInputTab === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs bg-teal-50/80 border border-teal-200/80 text-teal-900 rounded-xl px-3.5 py-2">
              <span className="font-semibold">
                🔵 وضع رفع الملفات والصور يستخدم مفتاح <b>Gemini</b> لقراءة PDF / TXT / DOCX والصور وتحليلها مباشرة
              </span>
            </div>

            <label
              htmlFor="research-file-input"
              className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 hover:bg-teal-50/30 transition flex flex-col items-center justify-center gap-3 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 group-hover:border-teal-300 group-hover:scale-105 transition flex items-center justify-center text-teal-700">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <strong className="text-sm sm:text-base text-slate-800 font-bold block">
                  اضغط هنا لاختيار ملف أو صورة للتحليل عبر Gemini
                </strong>
                <span className="text-xs text-slate-500 mt-1 block">
                  يدعم ملفات PDF الأكاديمية، مستندات DOCX / TXT / Markdown، والصور (PNG / JPG / WEBP)
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-900 transition">
                <FileCheck className="w-3.5 h-3.5 text-teal-600" />
                قراءة واستخراج آلي مدعوم بـ Gemini AI
              </span>
            </label>
            <input
              ref={fileInputRef}
              id="research-file-input"
              type="file"
              accept=".pdf,.txt,.md,.text,.docx,.png,.jpg,.jpeg,.webp,.gif"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Progress / Status */}
            {fileProgress && (
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs sm:text-sm font-medium flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                <div className="flex-1">
                  <span>{fileProgress.status}</span>
                  {fileProgress.percent !== undefined && (
                    <div className="w-full h-1.5 bg-teal-200 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-teal-600 transition-all duration-300"
                        style={{ width: `${fileProgress.percent}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {fileError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {uploadedFile && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {uploadedFile.isImage ? (
                      <ImageIcon className="w-4 h-4 text-teal-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    )}
                    <span className="font-bold text-slate-900">{uploadedFile.fileName}</span>
                    {uploadedFile.isImage ? (
                      <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 font-semibold">
                        صورة جاهزة للتحليل البصري عبر Gemini
                      </span>
                    ) : (
                      <span>
                        ({uploadedFile.pagesCount} صفحة • {uploadedFile.wordCount.toLocaleString()} كلمة)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {uploadedFile.text && (
                      <button
                        type="button"
                        onClick={() => setShowExtractedPreview((v) => !v)}
                        className="inline-flex items-center gap-1 text-teal-700 hover:underline font-bold text-xs"
                      >
                        {showExtractedPreview ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>إخفاء المعاينة</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة النص المستخرج</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClearUploaded}
                      className="inline-flex items-center gap-1 text-rose-600 hover:underline font-bold text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة الملف</span>
                    </button>
                  </div>
                </div>

                {uploadedFile.isImage && uploadedFile.inlineData?.previewUrl && (
                  <div className="pt-1">
                    <img
                      src={uploadedFile.inlineData.previewUrl}
                      alt={uploadedFile.fileName}
                      className="max-h-56 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  </div>
                )}

                {showExtractedPreview && uploadedFile.text && (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 max-h-48 overflow-y-auto text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {uploadedFile.text.slice(0, 4000)}
                    {uploadedFile.text.length > 4000 && '\n\n... (تم عرض أول 4000 حرف للمعاينة فقط)'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Link Tab (Pure Client-Side Copy/Paste -> OpenAI GPT-4o) */}
        {activeInputTab === 'link' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
              لتحليل بحث منشور على الإنترنت مباشرة من المتصفح (عبر GPT-4o)، ضع الرابط هنا للفتح السريع ثم انسخ نص البحث وألصقه في الصندوق أدناه:
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.org/research-paper (اختياري)"
                dir="ltr"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
              />
              {urlInput.trim().startsWith('http') && (
                <a
                  href={urlInput.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 shrink-0"
                >
                  <span>فتح الرابط للنسخ</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الصق نص البحث المنسوخ من الرابط هنا:
              </label>
              <textarea
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
                placeholder="انسخ محتوى البحث من الصفحة (Ctrl+A ثم Ctrl+C) وألصقه هنا مباشرة..."
                className="w-full min-h-[160px] p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 text-sm leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition placeholder:text-slate-400 resize-y"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>عدد الكلمات الملصوقة: <b className="text-slate-800">{wordCount.toLocaleString()}</b></span>
                {text && (
                  <button
                    type="button"
                    onClick={handleUseUrlAndPaste}
                    className="text-teal-700 hover:underline font-bold"
                  >
                    عرض في محرر النص
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
