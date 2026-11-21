import React from 'react';
import { AiDetectionResult } from '../types/research';
import {
  Bot,
  UserCheck,
  ShieldCheck,
  Repeat,
  BookA,
  AlertTriangle,
  BrainCircuit,
} from 'lucide-react';

interface AiDetectionSectionProps {
  result: AiDetectionResult;
  provider: 'openai' | 'gemini';
}

export const AiDetectionSection: React.FC<AiDetectionSectionProps> = ({
  result,
  provider,
}) => {
  const getVerdictStyle = () => {
    if (result.verdict === 'مولد بالذكاء الاصطناعي') {
      return {
        badge: 'bg-rose-100 text-rose-900 border-rose-300',
        border: 'border-rose-200',
        headerBg: 'from-rose-950 via-slate-900 to-rose-900',
      };
    }
    if (result.verdict === 'كتابة بشرية') {
      return {
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        border: 'border-emerald-200',
        headerBg: 'from-emerald-950 via-slate-900 to-teal-900',
      };
    }
    return {
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      border: 'border-amber-200',
      headerBg: 'from-amber-950 via-slate-900 to-slate-900',
    };
  };

  const style = getVerdictStyle();

  const indicatorCards = [
    {
      label: 'تكرار الأنماط اللغوية',
      hint: 'ارتفاعه يشير لأسلوب AI',
      value: result.indicators.repetitive_patterns,
      barColor: 'bg-rose-500',
      icon: <Repeat className="w-4 h-4 text-rose-600" />,
    },
    {
      label: 'تنوع المفردات',
      hint: 'ارتفاعه يشير لأسلوب بشري',
      value: result.indicators.vocabulary_diversity,
      barColor: 'bg-teal-600',
      icon: <BookA className="w-4 h-4 text-teal-600" />,
    },
    {
      label: 'الأخطاء البشرية الطبيعية',
      hint: 'وجودها يرفع نسبة البشري',
      value: result.indicators.human_errors,
      barColor: 'bg-emerald-600',
      icon: <AlertTriangle className="w-4 h-4 text-emerald-600" />,
    },
    {
      label: 'عمق التحليل الشخصي والتجارب',
      hint: 'ارتفاعه يشير لكتابة بشرية أعمق',
      value: result.indicators.personal_depth,
      barColor: 'bg-indigo-600',
      icon: <BrainCircuit className="w-4 h-4 text-indigo-600" />,
    },
  ];

  return (
    <div className={`bg-white rounded-2xl border ${style.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`bg-gradient-to-l ${style.headerBg} px-5 py-4 text-white flex items-center justify-between flex-wrap gap-3`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base sm:text-lg">
                تقرير كشف النصوص المولدة بالذكاء الاصطناعي
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-teal-200 border border-white/20">
                {provider === 'gemini' ? 'Gemini' : 'GPT-4o'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              فحص الأنماط اللغوية، تنوع المفردات، الترابط الآلي، والعمق الشخصي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-extrabold ${style.badge}`}>
            {result.verdict}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-white inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-300" />
            الثقة: <b className="font-mono">{result.confidence}%</b>
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* AI vs Human Split Summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-800 block">نسبة الذكاء الاصطناعي</span>
                  <span className="text-[11px] text-rose-600">احتمالية التوليد الآلي</span>
                </div>
              </div>
              <b className="text-2xl sm:text-3xl font-black font-mono text-rose-700">
                {result.ai_percentage}%
              </b>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-800 block">نسبة الكتابة البشرية</span>
                  <span className="text-[11px] text-emerald-600">احتمالية الصياغة البشرية</span>
                </div>
              </div>
              <b className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
                {result.human_percentage}%
              </b>
            </div>
          </div>

          {/* Combined 100% progress bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden bg-emerald-500 flex shadow-inner">
            <div
              className="h-full bg-rose-500 transition-all duration-700"
              style={{ width: `${result.ai_percentage}%` }}
              title={`AI: ${result.ai_percentage}%`}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${result.human_percentage}%` }}
              title={`بشري: ${result.human_percentage}%`}
            />
          </div>
        </div>

        {/* One-line Reason */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed">
          <span className="font-extrabold text-slate-900 ml-1.5">خلاصة التقييم:</span>
          <span>{result.reason}</span>
        </div>

        {/* 4 Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {indicatorCards.map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                    {item.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                    <span className="text-[10px] text-slate-500">{item.hint}</span>
                  </div>
                </div>
                <b className="text-sm font-black font-mono text-slate-900">{item.value}%</b>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.barColor} transition-all duration-700`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
