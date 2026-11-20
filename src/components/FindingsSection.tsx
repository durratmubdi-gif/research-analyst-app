import React, { useState } from 'react';
import { CheckCircle2, TrendingUp, Copy, Check } from 'lucide-react';

interface FindingsSectionProps {
  findings: string[];
}

export const FindingsSection: React.FC<FindingsSectionProps> = ({ findings }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyFindings = () => {
    navigator.clipboard.writeText(findings.map((f, i) => `${i + 1}. ${f}`).join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              أهم النتائج العلمية والاستنتاجات
            </h3>
            <p className="text-xs text-slate-500">
              المخرجات الأساسية للدراسة مدعومة بالبيانات والدلالات الإحصائية
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyFindings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
          title="نسخ كافة النتائج"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">تم النسخ</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>نسخ النتائج</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {findings && findings.length > 0 ? (
          findings.map((finding, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/20 transition flex items-start gap-3.5"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 font-mono">
                {idx + 1}
              </div>
              <div className="flex-1 text-slate-800 text-sm sm:text-base leading-relaxed">
                {finding}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            لم تُسجل نتائج واضحة في النص المقدم.
          </p>
        )}
      </div>
    </div>
  );
};
