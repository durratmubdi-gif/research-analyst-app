import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Globe } from 'lucide-react';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGeminiKey: (key: string) => void;
  onClearGeminiKey: () => void;
  onSaveOpenAiKey: (key: string) => void;
  onClearOpenAiKey: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  onSaveGeminiKey,
  onClearGeminiKey,
  onSaveOpenAiKey,
  onClearOpenAiKey,
}) => {
  const [geminiInput, setGeminiInput] = useState('');
  const [openAiInput, setOpenAiInput] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'success' | 'info' | 'warning';
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGeminiInput('');
      setOpenAiInput('');
      setShowGemini(false);
      setShowOpenAi(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGemini = geminiInput.trim();
    const cleanOpenAi = openAiInput.trim();

    if (!cleanGemini && !cleanOpenAi) {
      setStatusMessage({
        text: 'يرجى إدخال مفتاح Gemini أو OpenAI الخاص بك أولاً قبل الحفظ.',
        tone: 'warning',
      });
      return;
    }

    if (cleanGemini) {
      onSaveGeminiKey(cleanGemini);
    }
    if (cleanOpenAi) {
      onSaveOpenAiKey(cleanOpenAi);
    }

    setGeminiInput('');
    setOpenAiInput('');
    setStatusMessage({
      text: 'تم حفظ المفتاح المدخل محلياً في متصفحك بنجاح.',
      tone: 'success',
    });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleResetStoredKeys = () => {
    onClearGeminiKey();
    onClearOpenAiKey();
    setGeminiInput('');
    setOpenAiInput('');
    setStatusMessage({
      text: 'تم مسح المفاتيح من هذا المتصفح.',
      tone: 'info',
    });
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
                أدخل مفتاحك الشخصي عند الرغبة في التجربة؛ يُحفظ محلياً في متصفحك فقط
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
              عند تجربة المنصة عبر استضافة ثابتة، يمكنك إدخال مفتاحك الخاص هنا ليُستخدم مباشرة من متصفحك دون مشاركة أو تخزين على أي خادم خارجي.
            </span>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <label htmlFor="modal-gemini-key" className="block text-xs sm:text-sm font-bold text-slate-800">
              مفتاح Gemini API (للملفات، الصور، وتوليد الفصول)
            </label>

            <div className="relative">
              <input
                id="modal-gemini-key"
                type={showGemini ? 'text' : 'password'}
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                placeholder="أدخل مفتاح Gemini الخاص بك للتجربة (AIza...)"
                autoComplete="off"
                dir="auto"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition placeholder:text-slate-400"
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
            <label htmlFor="modal-openai-key" className="block text-xs sm:text-sm font-bold text-slate-800">
              مفتاح OpenAI API (لتحليل النصوص عبر GPT-4o وكبديل تلقائي)
            </label>

            <div className="relative">
              <input
                id="modal-openai-key"
                type={showOpenAi ? 'text' : 'password'}
                value={openAiInput}
                onChange={(e) => setOpenAiInput(e.target.value)}
                placeholder="أدخل مفتاح OpenAI الخاص بك للتجربة (sk-...)"
                autoComplete="off"
                dir="auto"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition placeholder:text-slate-400"
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
            <p
              className={`text-xs font-bold rounded-xl py-2 px-3 text-center border ${
                statusMessage.tone === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : statusMessage.tone === 'warning'
                    ? 'text-amber-800 bg-amber-50 border-amber-200'
                    : 'text-slate-700 bg-slate-50 border-slate-200'
              }`}
            >
              {statusMessage.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleResetStoredKeys}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition"
            >
              مسح المفاتيح من المتصفح
            </button>

            <div className="flex items-center gap-2.5">
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
                حفظ المفتاح محلياً
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeysModal;
