import React from 'react';
import { MethodologyBreakdown } from '../types/research';
import {
  Compass,
  Users,
  Wrench,
  BarChart2,
  AlertOctagon,
  Layers,
} from 'lucide-react';

interface MethodologySectionProps {
  methodology: MethodologyBreakdown;
  type: string;
}

export const MethodologySection: React.FC<MethodologySectionProps> = ({
  methodology,
  type,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              تفكيك المنهجية العلمية والأدوات
            </h3>
            <p className="text-xs text-slate-500">
              تحليل تفصيلي لأركان المنهج، العينة، الأدوات، والمعالجة الإحصائية
            </p>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
          التصميم: {type || 'منهج تحليلي'}
        </span>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1: Design */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>منهج وتصميم الدراسة</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {methodology?.design || 'لم يُحدد تصميم الدراسة بدقة في النص.'}
          </p>
        </div>

        {/* Pillar 2: Sample */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>مجتمع وعينة الدراسة وطريقة الاختيار</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {methodology?.sample || 'لم تُذكر تفاصيل كافية حول العينة وحجمها.'}
          </p>
        </div>

        {/* Pillar 3: Tools */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center text-xs">
              <Wrench className="w-3.5 h-3.5" />
            </div>
            <span>أدوات جمع البيانات وقياس الصدق والثبات</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {methodology?.tools || 'لم تتضح الأدوات المستخدمة في القياس.'}
          </p>
        </div>

        {/* Pillar 4: Statistical Analysis */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs">
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
            <span>أساليب التحليل والمعالجة الإحصائية</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {methodology?.analysis || 'لم يُفصح النص عن الأساليب الإحصائية المعتمدة.'}
          </p>
        </div>
      </div>

      {/* Limitations note if available */}
      {methodology?.limitations && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertOctagon className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <b className="block font-bold mb-0.5">حدود الدراسة المصرح بها:</b>
            <span>{methodology.limitations}</span>
          </div>
        </div>
      )}
    </div>
  );
};
