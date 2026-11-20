import React, { useState } from 'react';
import {
  CheckSquare,
  Bookmark,
  Download,
  Copy,
  Printer,
  Sparkles,
  Check,
  Mic,
} from 'lucide-react';

interface ActionPlanSectionProps {
  actionPlan: string[];
  presentationPitch?: string;
  onSave: () => void;
  onDownload: () => void;
  onCopyAll: () => void;
  onPrint: () => void;
  isSaved: boolean;
}

export const ActionPlanSection: React.FC<ActionPlanSectionProps> = ({
  actionPlan,
  presentationPitch,
  onSave,
  onDownload,
  onCopyAll,
  onPrint,
  isSaved,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopy = () => {
    onCopyAll();
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Elevator Pitch Card if available */}
      {presentationPitch && (
        <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                ملخص العرض السريع (Elevator Pitch - 60 ثانية)
              </h3>
              <p className="text-xs text-slate-300">
                صيغة مكثفة لتقديم فكرة ونتائج بحثك في المؤتمرات أو افتتاحية جلسة المناقشة
              </p>
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-xl text-xs sm:text-sm text-slate-100 leading-relaxed border border-white/10 font-normal">
            {presentationPitch}
          </div>
        </div>
      )}

      {/* Action Plan Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              خطة العمل المقترحة والتوصيات التطبيقية
            </h3>
            <p className="text-xs text-slate-500">
              خطوات إجرائية لتطوير البحث أو تعميم نتائجه ومعالجة الثغرات
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {actionPlan && actionPlan.length > 0 ? (
            actionPlan.map((step, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <span className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                  {step}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">لا توجد خطوات عمل متاحة.</p>
          )}
        </div>

        {/* Global Action Toolbar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2.5 no-print">
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              isSaved
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>تم الحفظ في مكتبتي ✅</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>💾 حفظ هذا البحث في مكتبتي</span>
              </>
            )}
          </button>

          <button
            onClick={onDownload}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>تحميل التقرير (Markdown)</span>
          </button>

          <button
            onClick={onPrint}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>طباعة أو حفظ PDF</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition flex items-center gap-2"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ كامل التحليل</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>نسخ كل التحليل</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
