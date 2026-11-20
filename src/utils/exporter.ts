import { AnalysisResult } from '../types/research';

export function formatFullReportAsMarkdown(analysis: AnalysisResult, rawTextLength: number): string {
  const dateStr = new Date().toLocaleDateString('ar-SA');

  return `# تقرير التحليل الأكاديمي الشامل
**العنوان المقترح/المستخرج:** ${analysis.titleSuggestion}
**تاريخ التحليل:** ${dateStr}
**تصنيف الدراسة:** ${analysis.type}
**مؤشر الرصانة والجودة:** ${analysis.score} / 100
- المنهجية: ${analysis.scoreBreakdown?.methodology ?? 80}%
- الوضوح: ${analysis.scoreBreakdown?.clarity ?? 80}%
- قوة الأدلة: ${analysis.scoreBreakdown?.evidence ?? 80}%
- الأصالة: ${analysis.scoreBreakdown?.originality ?? 80}%

---

## 1. الكلمات المفتاحية
${(analysis.keywords || []).map((k) => `\`${k}\``).join(' • ')}

---

## 2. الملخص التنفيذي
${analysis.summary}

---

## 3. سؤال البحث، المشكلة والأهداف
${analysis.goal}

---

## 4. تفكيك المنهجية العلمية
- **تصميم ومنهج الدراسة:** ${analysis.methodology?.design || 'غير محدد بدقة'}
- **مجتمع وعينة الدراسة:** ${analysis.methodology?.sample || 'غير محدد بدقة'}
- **أدوات جمع البيانات:** ${analysis.methodology?.tools || 'غير محدد بدقة'}
- **أساليب التحليل والمعالجة:** ${analysis.methodology?.analysis || 'غير محدد بدقة'}
${analysis.methodology?.limitations ? `- **الحدود المعلنة:** ${analysis.methodology.limitations}` : ''}

---

## 5. أبرز النتائج العلمية
${(analysis.findings || []).map((f, i) => `${i + 1}. ${f}`).join('\n')}

---

## 6. نقاط القوة والتميز المنهجي
${(analysis.strengths || []).map((s) => `- ${s}`).join('\n')}

---

## 7. نقاط الضعف، الفجوات، والحدود
${(analysis.weaknesses || []).map((w) => `- ${w}`).join('\n')}

---

## 8. بنك أسئلة المناقشة والدفاع الأكاديمي
${(analysis.questions || [])
  .map(
    (q, i) => `### س ${i + 1}: ${q.question}
**سياق السؤال وما يختبره المحكم:** ${q.context}
**الإجابة الدفاعية النموذجية:**
${q.recommendedAnswer}
`
  )
  .join('\n---\n')}

---

## 9. خطة العمل والتوصيات الإجرائية
${(analysis.actionPlan || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}

${
  analysis.presentationPitch
    ? `---

## 10. ملخص العرض التقديمي (Elevator Pitch - 60 ثانية)
${analysis.presentationPitch}
`
    : ''
}

---
*تم توليد هذا التقرير بواسطة محلل الأبحاث الأكاديمية - مدعوم بنموذج Google Gemini AI.*
`;
}

export function downloadTextFile(content: string, filename: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
