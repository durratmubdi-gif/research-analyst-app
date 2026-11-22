import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Trash2, CheckCircle2, Globe } from 'lucide-react';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiKey: string;
  openAiKey: string;
  onSaveGeminiKey: (key: string) => void;
  onClearGeminiKey: () => void;
  onSaveOpenAiKey: (key: string) => void;
  onClearOpenAiKey: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  geminiKey,
  openAiKey,
  onSaveGeminiKey,
  onClearGeminiKey,
  onSaveOpenAiKey,
  onClearOpenAiKey,
}) => {
  const [geminiInput, setGeminiInput] = useState('');
  const [openAiInput, setOpenAiInput] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGeminiInput(geminiKey);
      setOpenAiInput(openAiKey);
      setStatusMessage(null);
    }
  }, [isOpen, geminiKey, openAiKey]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGemini = geminiInput.trim();
    const cleanOpenAi = openAiInput.trim();

    if (cleanGemini) {
      onSaveGeminiKey(cleanGemini);
    } else if (geminiKey) {
      onClearGeminiKey();
    }

    if (cleanOpenAi) {
      onSaveOpenAiKey(cleanOpenAi);
    } else if (openAiKey) {
      onClearOpenAiKey();
    }

    setStatusMessage('تم حفظ إعدادات المفاتيح محلياً في المتصفح بنجاح ✅');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-settings-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h2 id="api-settings-title" className="font-extrabold text-base sm:text-lg">
                إعدادات مفتاح API
              </h2>
              <p className="text-[11px] text-slate-300">
                تُحفظ المفاتيح محلياً في المتصفح (localStorage) للعمل مباشرة على الاستضافة الثابتة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة إعدادات API"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200/80 text-xs text-teal-900 flex items-start gap-2.5 leading-relaxed">
            <Globe className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              عند النشر على استضافة ثابتة مثل GitHub Pages حيث لا يتوفر خادم خلفي، يستخدم التطبيق هذه المفاتيح مباشرة من متصفحك لإتمام التحليل وكتابة الفصول دون أخطاء 405.
            </span>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="modal-gemini-key" className="text-xs sm:text-sm font-bold text-slate-800">
                مفتاح Gemini API (للملفات، الصور، وتوليد الفصول)
              </label>
              <div className="flex items-center gap-2">
                {geminiKey && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>محفوظ</span>
                  </span>
                )}
                {geminiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearGeminiKey();
                      setGeminiInput('');
                    }}
                    title="مسح مفتاح Gemini"
                    className="text-rose-600 hover:text-rose-800 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                id="modal-gemini-key"
                type={showGemini ? 'text' : 'password'}
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
                dir="ltr"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
              />
              <button
                type="button"
                onClick={() => setShowGemini((s) => !s)}
                aria-label={showGemini ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="modal-openai-key" className="text-xs sm:text-sm font-bold text-slate-800">
                مفتاح OpenAI API (لتحليل النصوص عبر GPT-4o وكبديل تلقائي)
              </label>
              <div className="flex items-center gap-2">
                {openAiKey && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>محفوظ</span>
                  </span>
                )}
                {openAiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearOpenAiKey();
                      setOpenAiInput('');
                    }}
                    title="مسح مفتاح OpenAI"
                    className="text-rose-600 hover:text-rose-800 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                id="modal-openai-key"
                type={showOpenAi ? 'text' : 'password'}
                value={openAiInput}
                onChange={(e) => setOpenAiInput(e.target.value)}
                placeholder="sk-proj-..."
                autoComplete="off"
                dir="ltr"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
              />
              <button
                type="button"
                onClick={() => setShowOpenAi((s) => !s)}
                aria-label={showOpenAi ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showOpenAi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {statusMessage && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 text-center">
              {statusMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition"
            >
              إغلاق
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-teal-900 text-white text-sm font-bold transition"
            >
              حفظ المفاتيح محلياً
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeysModal;
