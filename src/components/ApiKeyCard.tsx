import React, { useState } from 'react';
import {
  Key,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface ApiKeyCardProps {
  apiKey: string;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  apiKey,
  onSaveKey,
  onClearKey,
}) => {
  const [inputValue, setInputValue] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!apiKey);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isSaved = Boolean(apiKey.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setStatusMessage('الرجاء لصق مفتاح Gemini API أولاً');
      return;
    }
    onSaveKey(trimmed);
    setStatusMessage('تم حفظ المفتاح في متصفحك بنجاح ✅');
    setTimeout(() => {
      setStatusMessage(null);
      setIsExpanded(false);
    }, 1200);
  };

  const handleClear = () => {
    setInputValue('');
    onClearKey();
    setStatusMessage('تم مسح المفتاح من المتصفح');
    setIsExpanded(true);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  return (
    <div
      id="api-key-card"
      className={`rounded-2xl border transition no-print ${
        isSaved
          ? 'bg-emerald-50/40 border-emerald-200/90'
          : 'bg-amber-50/60 border-amber-200 shadow-xs'
      }`}
    >
      {/* Header row */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 sm:px-5 py-3.5 flex items-center justify-between cursor-pointer gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isSaved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            <Key className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                مفتاح Gemini API الشخصي
              </h3>
              {isSaved ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  محفوظ وجاهز
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  مطلوب للتحليل
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 truncate">
              {isSaved
                ? 'يُحفظ في متصفحك (localStorage) فقط ويتصل مباشرة بـ Google Gemini من المتصفح'
                : 'أدخل مفتاح Google Gemini المجاني للبدء بالتحليل من متصفحك مباشرة'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-white/70 transition shrink-0"
          aria-label="تبديل عرض إعدادات المفتاح"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable body */}
      {isExpanded && (
        <form onSubmit={handleSave} className="px-4 sm:px-5 pb-4 pt-1 space-y-3 border-t border-slate-200/60">
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="AIzaSy... الصق مفتاح Gemini هنا"
                dir="ltr"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-teal-900 text-white text-xs sm:text-sm font-bold transition"
              >
                حفظ المفتاح
              </button>

              {isSaved && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 text-xs sm:text-sm font-semibold transition flex items-center gap-1"
                  title="مسح المفتاح"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>مسح</span>
                </button>
              )}
            </div>
          </div>

          {statusMessage && (
            <p className="text-xs font-bold text-teal-800">{statusMessage}</p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              المفتاح يبقى محفوظاً في جهازك (localStorage) فقط ولا يُرسل إلى أي خادم وسيط.
            </span>

            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-bold hover:underline shrink-0"
            >
              <span>احصل على مفتاح مجاني من Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      )}
    </div>
  );
};
