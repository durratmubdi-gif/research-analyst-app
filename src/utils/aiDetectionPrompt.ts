import { AiDetectionResult, AiDetectionVerdict } from '../types/research';

export const AI_DETECTION_SYSTEM_PROMPT = `أنت محلل خبير في كشف النصوص المولدة بالذكاء الاصطناعي.
مهمتك تحليل النصوص الأكاديمية العربية والإنجليزية.

حلل النص التالي وأرجع النتيجة بصيغة JSON فقط، بدون أي شرح خارج الـ JSON.

معايير التحليل:
1. تكرار الأنماط اللغوية - الجمل المثالية جداً غالباً AI
2. تنوع المفردات - البشر يستخدمون كلمات غير متوقعة أكثر
3. الأخطاء البشرية الطبيعية - وجودها يرفع نسبة البشري
4. عمق التحليل الشخصي والتجارب - البشر أعمق
5. ترابط الجمل بشكل آلي ومتوقع - علامة AI`;

export function buildAiDetectionUserPrompt(text: string): string {
  const snippet = text.trim()
    ? text.slice(0, 35000)
    : '[محتوى الملف أو الصورة المرفقة — استخرج النص منها أولاً ثم طبق معايير الكشف]';

  return `حلل هذا النص:
"""
${snippet}
"""

أرجع النتيجة بهذا الشكل بالضبط:

{
  "ai_percentage": 65,
  "human_percentage": 35,
  "confidence": 88,
  "verdict": "مختلط",
  "reason": "سبب مختصر في سطر واحد، لماذا اخترت هذه النسبة",
  "indicators": {
    "repetitive_patterns": 70,
    "vocabulary_diversity": 45,
    "human_errors": 20,
    "personal_depth": 30
  }
}

قواعد مهمة:
- ai_percentage + human_percentage = 100 بالضبط
- verdict يكون واحد من ثلاثة فقط: "كتابة بشرية" / "مختلط" / "مولد بالذكاء الاصطناعي"
- اذا ai_percentage > 70 يكون verdict = "مولد بالذكاء الاصطناعي"
- اذا ai_percentage < 30 يكون verdict = "كتابة بشرية"
- غير كذا يكون verdict = "مختلط"
- لا ترجع أي نص خارج الـ JSON`;
}

function clampPercent(val: unknown, fallback = 50): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function normalizeAiDetectionResult(rawJson: string): AiDetectionResult {
  const cleaned = rawJson
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<AiDetectionResult>;

  const aiPct = clampPercent(parsed.ai_percentage, 50);
  const humanPct = 100 - aiPct;
  const confidence = clampPercent(parsed.confidence, 75);

  let verdict: AiDetectionVerdict = 'مختلط';
  if (aiPct > 70) {
    verdict = 'مولد بالذكاء الاصطناعي';
  } else if (aiPct < 30) {
    verdict = 'كتابة بشرية';
  }

  const indicators = {
    repetitive_patterns: clampPercent(parsed.indicators?.repetitive_patterns, aiPct),
    vocabulary_diversity: clampPercent(parsed.indicators?.vocabulary_diversity, humanPct),
    human_errors: clampPercent(parsed.indicators?.human_errors, humanPct),
    personal_depth: clampPercent(parsed.indicators?.personal_depth, humanPct),
  };

  return {
    ai_percentage: aiPct,
    human_percentage: humanPct,
    confidence,
    verdict,
    reason: (parsed.reason || 'تم تقييم النص بناءً على الأنماط اللغوية وتنوع المفردات وعمق التحليل.').trim(),
    indicators,
  };
}
