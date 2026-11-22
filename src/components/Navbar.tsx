import React from 'react';
import { BookOpen, Sparkles, Bookmark, RotateCcw, Printer, Settings, Key } from 'lucide-react';

interface NavbarProps {
  savedCount: number;
  onOpenSaved: () => void;
  onReset: () => void;
  hasResults: boolean;
  onPrint: () => void;
  onOpenApiSettings: () => void;
  isKeyPage: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  savedCount,
  onOpenSaved,
  onReset,
  hasResults,
  onPrint,
  onOpenApiSettings,
  isKeyPage,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-teal-800 flex items-center justify-center text-white shadow-md shadow-indigo-950/20">
            <BookOpen className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                محلل الأبحاث الأكاديمية
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/70">
                <Sparkles className="w-3 h-3 text-teal-600 animate-pulse" />
                GPT-4o &amp; Gemini
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              المنصة الذكية لتلخيص ونقد وتفكيك الأوراق العلمية والأطروحات
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {hasResults && (
            <button
              onClick={onPrint}
              title="طباعة التقرير أو حفظه كـ PDF"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenApiSettings}
            title="إعدادات مفتاح Gemini و OpenAI API"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border bg-white hover:bg-slate-100 text-slate-700 border-slate-200 transition"
          >
            <Key className="w-3.5 h-3.5 text-slate-600" />
            <span>إعدادات مفتاح API</span>
            <Settings className="w-3 h-3 text-slate-400 hidden sm:inline" />
          </button>

          <button
            onClick={onOpenSaved}
            className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs sm:text-sm font-semibold transition"
          >
            <Bookmark className="w-4 h-4 text-slate-600" />
            <span>مكتبتي المحفوظة</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[11px] font-bold">
                {savedCount}
              </span>
            )}
          </button>

          {hasResults && !isKeyPage && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-medium transition"
              title="بدء تحليل جديد"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">بحث جديد</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
