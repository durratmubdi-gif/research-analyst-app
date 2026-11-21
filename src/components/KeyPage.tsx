import React, { useState } from 'react';
import {
  Key,
  Lock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

const PAGE_PASSWORD = 'Aakkmm@2013';
const STORAGE_KEY = 'key_authorized';

interface KeyPageProps {
  hasOpenAiKey: boolean;
  onSaveOpenAiKey: (key: string) => void;
  onBack: () => void;
}

export const KeyPage: React.FC<KeyPageProps> = ({
  hasOpenAiKey,
  onSaveOpenAiKey,
  onBack,
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'yes';
    } catch {
      return false;
    }
  });
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');

  const [openAiInput, setOpenAiInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === PAGE_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'yes');
      } catch {
        // ignore storage restrictions
      }
      setAccessDenied(false);
      setIsAuthorized(true);
      setPasswordInput('');
    } else {
      setAccessDenied(true);
      setPasswordInput('');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOpenAi = openAiInput.trim();
    if (!trimmedOpenAi) {
      setStatusMessage('الرجاء إدخال المفتاح أولاً قبل الحفظ');
      return;
    }
    onSaveOpenAiKey(trimmedOpenAi);
    setOpenAiInput('');
    setStatusMessage('تم حفظ المفتاح بنجاح ✅');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // 1. Wrong password: show access denied ONLY, hide all page content & key
  if (!isAuthorized && accessDenied) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg border border-slate-200 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-[#c00] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#c00] m-0">
            🚫 غير مصرح بالوصول
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            الرقم السري غير صحيح
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold transition inline-flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى محلل الأبحاث</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Before authorization: key field & save button are completely hidden until passcode entered
  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-teal-900 px-6 py-6 text-white text-center space-y-2">
            <div className="w-11 h-11 mx-auto rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-300" />
            </div>
            <h2 className="text-lg font-extrabold">⚠️ صفحة المفتاح محمية</h2>
            <p className="text-xs text-slate-300">
              المحتوى والمفتاح مخفيان تماماً حتى إدخال الرقم السري الصحيح
            </p>
          </div>

          <form onSubmit={handleUnlock} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="key-page-password"
                className="block text-sm font-bold text-slate-800"
              >
                أدخل الرقم السري:
              </label>
              <input
                id="key-page-password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
                autoComplete="off"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
              />
            </div>

            <button
              type="submit"
              disabled={!passwordInput}
              className="w-full py-3 px-5 rounded-xl bg-slate-900 hover:bg-teal-900 disabled:opacity-40 text-white font-bold text-sm transition"
            >
              دخول
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold inline-flex items-center gap-1"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة إلى محلل الأبحاث</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. Authorized: OpenAI key input + save button only (Gemini runs server-side via environment secret)
  return (
    <div className="max-w-lg mx-auto py-8 space-y-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى محلل الأبحاث</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">
            مفتاح OpenAI API
          </h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="openai-key-field" className="text-sm font-bold text-slate-800">
                مفتاح OpenAI API (لتحليل النصوص عبر GPT-4o)
              </label>
              {hasOpenAiKey && (
                <span className="text-[11px] font-bold text-emerald-700">محفوظ ✓</span>
              )}
            </div>
            <input
              id="openai-key-field"
              type="password"
              value={openAiInput}
              onChange={(e) => setOpenAiInput(e.target.value)}
              placeholder="أدخل مفتاح OpenAI هنا..."
              autoComplete="off"
              dir="ltr"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 transition text-left"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-5 rounded-xl bg-slate-900 hover:bg-teal-900 text-white text-sm font-bold transition"
          >
            حفظ المفتاح
          </button>

          {statusMessage && (
            <p className="text-xs font-bold text-teal-800 text-center">{statusMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
};
