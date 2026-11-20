import React from 'react';
import { AnalysisMode } from '../types/research';
import { Sparkles, Compass, ShieldAlert, Award, FileSearch, Layers } from 'lucide-react';

interface AnalysisControlsProps {
  mode: AnalysisMode;
  onChangeMode: (mode: AnalysisMode) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  canAnalyze: boolean;
  loadingStepText?: string;
}

export const AnalysisControls: React.FC<AnalysisControlsProps> = ({
  mode,
  onChangeMode,
  onAnalyze,
  isLoading,
  canAnalyze,
  loadingStepText,
}) => {
  const modes: Array<{
    id: AnalysisMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'full',
      label: 'تحليل أكاديمي شامل',
      desc: 'بنية متكاملة: أهداف، تفكيك منهجية، نتائج، نقد، وأسئلة دفاع',
      icon: <Layers className="w-4 h-4 text-teal-600" />,
    },
    {
      id: 'summary',
      label: 'ملخص تنفيذي مركّز',
      desc: 'استخلاص الفكرة الجوهرية والنتائج الرئيسية في دقائق',
      icon: <FileSearch className="w-4 h-4 text-indigo-600" />,
    },
    {
      id: 'critical',
      label: 'نقد منهجي عميق',
      desc: 'فحص العينة، الأدوات، التحيزات، وحدود صدق النتائج',
      icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    },
    {
      id: 'presentation',
      label: 'تحضير لمناقشة الأطروحة',
      desc: 'أسئلة لجنة التحكيم، الردود الدفاعية، وملخص 60 ثانية',
      icon: <Award className="w-4 h-4 text-emerald-600" />,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4 no-print">
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          اختر زاوية التحليل الأكاديمي المطلوبة:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {modes.map((m) => {
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeMode(m.id)}
                className={`p-3 rounded-xl border text-right transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs sm:text-sm">{m.label}</span>
                  <div
                    className={`p-1 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {m.icon}
                  </div>
                </div>
                <p
                  className={`text-[11px] leading-tight ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {m.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Action Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onAnalyze}
          disabled={isLoading || !canAnalyze}
          className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base transition flex items-center justify-center gap-2.5 shadow-lg ${
            isLoading || !canAnalyze
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-900 hover:from-slate-800 hover:to-teal-800 text-white shadow-teal-950/20 active:scale-[0.99]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>{loadingStepText || 'جاري تحليل البحث بواسطة Gemini AI...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-teal-300 animate-pulse" />
              <span>حلل البحث الأكاديمي الآن ✨</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
