import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Target,
  HelpCircle,
} from 'lucide-react';

interface ExecutiveSummarySectionProps {
  summary: string;
  goal: string;
}

export const ExecutiveSummarySection: React.FC<ExecutiveSummarySectionProps> = ({
  summary,
  goal,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleToggleAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('ميزة القراءة الصوتية غير مدعومة في متصفحك.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;

    // Try finding Arabic voice
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  return (
    <div className="space-y-4">
      {/* Executive Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              الملخص التنفيذي الأكاديمي
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAudio}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isPlayingAudio
                  ? 'bg-teal-600 text-white border-teal-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="استماع صوتي للملخص"
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                  <span>إيقاف الصوت</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>قراءة صوتية</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
              title="نسخ نص الملخص"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>نسخ الملخص</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100 font-normal">
          {summary || 'لا يوجد ملخص متاح.'}
        </div>
      </div>

      {/* Goal & Research Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              سؤال البحث الرئيسي، الفرضيات والأهداف
            </h3>
            <p className="text-xs text-slate-500">
              تحديد المشكلة الجوهرية والغاية الأكاديمية التي تسعى الدراسة للإجابة عنها
            </p>
          </div>
        </div>

        <div className="text-slate-800 text-sm sm:text-base leading-relaxed bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
          {goal || 'لم يُحدد سؤال أو هدف واضح في النص المقدم.'}
        </div>
      </div>
    </div>
  );
};
