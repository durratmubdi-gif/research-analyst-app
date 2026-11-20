import React from 'react';
import { AnalysisResult } from '../types/research';
import {
  Award,
  BookOpen,
  Clock,
  FileText,
  Layers,
  Sparkles,
  TrendingUp,
  Tag,
  CheckCircle2,
} from 'lucide-react';

interface ResultsOverviewProps {
  analysis: AnalysisResult;
  wordCount: number;
  readingTime: number;
  sentencesCount: number;
}

export const ResultsOverview: React.FC<ResultsOverviewProps> = ({
  analysis,
  wordCount,
  readingTime,
  sentencesCount,
}) => {
  const score = analysis.score ?? 75;
  const breakdown = analysis.scoreBreakdown || {
    methodology: Math.min(100, score + 4),
    clarity: score,
    evidence: Math.max(50, score - 3),
    originality: Math.min(100, score + 2),
  };

  // Color determination based on score
  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (val >= 70) return 'text-teal-700 bg-teal-50 border-teal-200';
    if (val >= 55) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getScoreFill = (val: number) => {
    if (val >= 85) return 'bg-emerald-500';
    if (val >= 70) return 'bg-teal-500';
    if (val >= 55) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Title & Type Header */}
      <div className="space-y-2 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-teal-300">
            <Layers className="w-3.5 h-3.5" />
            {analysis.type || 'بحث أكاديمي تحليلي'}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <Sparkles className="w-3 h-3 text-teal-600" />
            تحليل بالذكاء الاصطناعي الأكاديمي
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
          {analysis.titleSuggestion || 'العنوان الأكاديمي المقترح للبحث'}
        </h2>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1 mb-1">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            عدد الكلمات
          </span>
          <b className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {wordCount.toLocaleString()}
          </b>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            زمن القراءة المتوقع
          </span>
          <b className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ~{readingTime} دقيقة
          </b>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
            عدد الجمل
          </span>
          <b className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {sentencesCount}
          </b>
        </div>

        <div className={`p-3.5 rounded-xl border text-center ${getScoreColor(score)}`}>
          <span className="text-xs font-semibold flex items-center justify-center gap-1 mb-1">
            <Award className="w-3.5 h-3.5" />
            الرصانة والتماسك
          </span>
          <b className="text-xl sm:text-2xl font-black font-mono">
            {score}%
          </b>
        </div>
      </div>

      {/* Quality Breakdown Bars */}
      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>مؤشر التقييم الأكاديمي المعياري</span>
          <span>{score} / 100</span>
        </div>

        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${getScoreFill(score)}`}
            style={{ width: `${score}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>المنهجية:</span>
              <b className="font-mono">{breakdown.methodology}%</b>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600"
                style={{ width: `${breakdown.methodology}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>الوضوح والأسلوب:</span>
              <b className="font-mono">{breakdown.clarity}%</b>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600"
                style={{ width: `${breakdown.clarity}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>قوة الأدلة:</span>
              <b className="font-mono">{breakdown.evidence}%</b>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600"
                style={{ width: `${breakdown.evidence}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>الأصالة والقيمة:</span>
              <b className="font-mono">{breakdown.originality}%</b>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600"
                style={{ width: `${breakdown.originality}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Keywords */}
      {analysis.keywords && analysis.keywords.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Tag className="w-3.5 h-3.5 text-teal-600" />
            <span>المفاهيم والكلمات المفتاحية المستخلصة:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.keywords.map((kw, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-xs font-medium border border-slate-200 hover:border-teal-300 transition cursor-default"
              >
                #{kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
