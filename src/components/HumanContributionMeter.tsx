import React from 'react';

interface HumanContributionMeterProps {
  notesText?: string;
  outlineModified?: boolean;
}

export const HumanContributionMeter: React.FC<HumanContributionMeterProps> = ({
  notesText = '',
  outlineModified = false,
}) => {
  const safeNotes = typeof notesText === 'string' ? notesText : '';

  // حساب عدد الكلمات المدخلة في خانة الملاحظات
  const wordsCount = safeNotes
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  // حساب النسبة التفاعلية (تصل إلى 100% عند كتابة ~40 كلمة أو تعديل المخطط)
  const score = Math.min(
    100,
    Math.round((wordsCount / 40) * 80) + (outlineModified ? 20 : 0)
  );

  // تحديد الحالة واللون والرسالة التوجيهية
  let status = {
    label: 'منخفضة جداً (يُتوقع ارتفاع نسبة AI)',
    barColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  };

  if (score >= 60) {
    status = {
      label: 'ممتازة! بصمتك البشرية واضحة وتخفض نسبة AI بفعالية',
      barColor: 'bg-emerald-600',
      textColor: 'text-emerald-800',
      bgColor: 'bg-emerald-50 border-emerald-200',
    };
  } else if (score >= 25) {
    status = {
      label: 'جيدة — أضف مثالاً أو رأياً إضافياً لخفض النسبة أكثر',
      barColor: 'bg-teal-500',
      textColor: 'text-teal-800',
      bgColor: 'bg-teal-50 border-teal-200',
    };
  }

  return (
    <div
      dir="rtl"
      className={`mt-3 p-3 rounded-lg border transition-all duration-300 ${status.bgColor}`}
    >
      <div className="flex items-center justify-between mb-1.5 text-xs font-semibold gap-2 flex-wrap">
        <span className={status.textColor}>
          مؤشر البصمة البشرية: {score}% ({status.label})
        </span>
        <span className="text-gray-500 tabular-nums">
          {wordsCount} كلمة مضافة
        </span>
      </div>

      {/* شريط التقدم التفاعلي */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${status.barColor}`}
          style={{ width: `${Math.max(score, 5)}%` }}
        />
      </div>
    </div>
  );
};

export default HumanContributionMeter;
