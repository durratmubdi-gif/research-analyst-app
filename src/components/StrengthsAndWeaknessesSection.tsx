import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

interface StrengthsAndWeaknessesSectionProps {
  strengths?: string[];
  weaknesses?: string[];
}

export const StrengthsAndWeaknessesSection: React.FC<StrengthsAndWeaknessesSectionProps> = ({
  strengths,
  weaknesses,
}) => {
  const safeStrengths = Array.isArray(strengths) ? strengths : [];
  const safeWeaknesses = Array.isArray(weaknesses) ? weaknesses : [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Strengths Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              نقاط القوة والتميز المنهجي
            </h3>
            <p className="text-xs text-slate-500">
              الجوانب الإيجابية التي تمنح الدراسة مصداقية علمية
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {safeStrengths.length > 0 ? (
            safeStrengths.map((str, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {str}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">لا توجد نقاط قوة مسجلة.</p>
          )}
        </div>
      </div>

      {/* Weaknesses and Gaps Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              الفجوات ونقاط الضعف المنهجية
            </h3>
            <p className="text-xs text-slate-500">
              المآخذ المحتملة والحدود التي ينبغي للباحث الاستعداد لتبريرها
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {safeWeaknesses.length > 0 ? (
            safeWeaknesses.map((weak, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {weak}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">لا توجد نقاط ضعف مسجلة.</p>
          )}
        </div>
      </div>
    </div>
  );
};
