import React, { useState } from 'react';
import { DefenseQuestion } from '../types/research';
import {
  HelpCircle,
  MessageSquare,
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Lightbulb,
} from 'lucide-react';

interface DefenseQuestionsSectionProps {
  questions: DefenseQuestion[];
}

export const DefenseQuestionsSection: React.FC<DefenseQuestionsSectionProps> = ({
  questions,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedIndices, setExpandedIndices] = useState<number[]>(
    questions.map((_, i) => i) // Default all expanded for ease of reading
  );

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              بنك أسئلة المناقشة ولجنة التحكيم (Thesis Defense Simulator)
            </h3>
            <p className="text-xs text-slate-500">
              أقوى الأسئلة المتوقعة من المحكمين مع إرشادات الإجابة الدفاعية النموذجية
            </p>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
          {questions?.length || 0} أسئلة محورية
        </span>
      </div>

      <div className="space-y-4">
        {questions && questions.length > 0 ? (
          questions.map((item, idx) => {
            const isExpanded = expandedIndices.includes(idx);
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 transition hover:border-indigo-300"
              >
                {/* Question Header */}
                <div
                  onClick={() => toggleExpand(idx)}
                  className="p-4 cursor-pointer flex items-start justify-between gap-3 bg-white"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-md bg-indigo-900 text-white flex items-center justify-center text-xs font-bold shrink-0 font-mono mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {item.question}
                      </h4>
                      {item.context && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>ما يختبره المحكم: {item.context}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Recommended Answer Body */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-100 bg-indigo-50/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-700" />
                        صيغة الإجابة الدفاعية المقترحة (الفكرة • الدليل • الخلاصة):
                      </span>

                      <button
                        onClick={() => handleCopy(item.recommendedAnswer, idx)}
                        className="text-xs font-semibold text-slate-500 hover:text-indigo-800 flex items-center gap-1 transition"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ الرد</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs whitespace-pre-line font-normal">
                      {item.recommendedAnswer}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-400 py-4 text-center">
            لا توجد أسئلة مناقشة مولدة لهذا القسم.
          </p>
        )}
      </div>
    </div>
  );
};
