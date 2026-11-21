import React from 'react';
import { AiDetectionResult } from '../types/research';
import {
  Bot,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
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
  const getVerdictDisplay = () => {
    if (result.verdict === 'AI Generated') {
      return {
        label: 'AI Generated • مولد بالذكاء الاصطناعي',
        badge: 'bg-rose-100 text-rose-900 border-rose-300',
        border: 'border-rose-200',
        headerBg: 'from-rose-950 via-slate-900 to-rose-900',
      };
    }
    if (result.verdict === 'Human Written') {
      return {
        label: 'Human Written • كتابة بشرية',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        border: 'border-emerald-200',
        headerBg: 'from-emerald-950 via-slate-900 to-teal-900',
      };
    }
    return {
      label: 'Mixed • مختلط',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      border: 'border-amber-200',
      headerBg: 'from-amber-950 via-slate-900 to-slate-900',
    };
  };

  const style = getVerdictDisplay();

  const indicatorCards = [
    {
      label: 'تكرار الأنماط اللغوية',
      hint: 'توقع البنية وتكرار الصياغة (AI)',
      value: result.repetitive_patterns,
      barColor: 'bg-rose-500',
      icon: <Repeat className="w-4 h-4 text-rose-600" />,
    },
    {
      label: 'تنوع المفردات',
      hint: 'ثراء وتنوع الأسلوب اللفظي',
      value: result.vocabulary_diversity,
      barColor: 'bg-teal-600',
      icon: <BookA className="w-4 h-4 text-teal-600" />,
    },
    {
      label: 'نسبة الأخطاء البشرية',
      hint: '0% مثالي جداً • 1-3% طبيعي • 10%+ مصطنع',
      value: result.human_errors,
      barColor: 'bg-emerald-600',
      icon: <AlertTriangle className="w-4 h-4 text-emerald-600" />,
    },
    {
      label: 'عمق التجربة الشخصية والعاطفة',
      hint: 'التنوع الشعوري والخبرة الشخصية',
      value: result.personal_depth,
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
              تقييم طبيعة التدفق، قابلية التنبؤ بالبنية، التجربة الشخصية، ونسبة الأخطاء
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-extrabold ${style.badge}`}>
            {style.label}
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
                  <span className="text-[11px] text-rose-600">AI Percentage</span>
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
                  <span className="text-[11px] text-emerald-600">Human Percentage</span>
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
              title={`Human: ${result.human_percentage}%`}
            />
          </div>
        </div>

        {/* Manipulation Attempt Status */}
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 ${
            result.manipulation_attempt
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {result.manipulation_attempt ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>
              {result.manipulation_attempt
                ? 'تم رصد محاولة تلاعب أو افتعال أخطاء/أنماط للتمويه على الكاشف'
                : 'لم يتم رصد محاولات تلاعب مصطنعة في أسلوب الكتابة'}
            </span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg font-mono text-xs shrink-0 ${
              result.manipulation_attempt
                ? 'bg-rose-200/70 text-rose-900'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            manipulation_attempt: {String(result.manipulation_attempt)}
          </span>
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
