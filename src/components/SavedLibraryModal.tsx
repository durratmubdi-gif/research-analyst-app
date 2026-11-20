import React, { useState } from 'react';
import { SavedResearch } from '../types/research';
import {
  X,
  Search,
  BookOpen,
  Calendar,
  FileText,
  Trash2,
  ExternalLink,
  Award,
  Download,
} from 'lucide-react';
import { formatFullReportAsMarkdown, downloadTextFile } from '../utils/exporter';

interface SavedLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedList: SavedResearch[];
  onOpenItem: (item: SavedResearch) => void;
  onDeleteItem: (id: string) => void;
}

export const SavedLibraryModal: React.FC<SavedLibraryModalProps> = ({
  isOpen,
  onClose,
  savedList,
  onOpenItem,
  onDeleteItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filtered = savedList.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.type && item.type.toLowerCase().includes(q)) ||
      (item.analysis?.titleSuggestion && item.analysis.titleSuggestion.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">مكتبة الأبحاث المحفوظة</h2>
              <p className="text-xs text-slate-500">
                {savedList.length} أبحاث محفوظة محلياً على جهازك
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في عناوين الأبحاث أو أنواع المنهجيات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-600">لا توجد أبحاث محفوظة مطابقة</p>
              <p className="text-xs text-slate-400 mt-1">
                عند تحليل أي بحث علمي، اضغط على زر "حفظ هذا البحث" للرجوع إليه لاحقاً في أي وقت.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200/90 hover:border-teal-300 hover:shadow-md transition bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {item.type || 'بحث أكاديمي'}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-600" />
                      جودة {item.score}%
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.date}
                    </span>
                    <span>•</span>
                    <span>{item.wordCount.toLocaleString()} كلمة</span>
                    <span>•</span>
                    <span>~{item.readingTime} د قراءة</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      const md = formatFullReportAsMarkdown(item.analysis, item.rawText.length);
                      downloadTextFile(md, `${item.title.slice(0, 25)}.md`);
                    }}
                    title="تحميل التقرير كملف Markdown"
                    className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من رغبتك في حذف بحث: "${item.title}"؟`)) {
                        onDeleteItem(item.id);
                      }
                    }}
                    title="حذف هذا البحث"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      onOpenItem(item);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-teal-900 text-white text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <span>فتح التحليل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
