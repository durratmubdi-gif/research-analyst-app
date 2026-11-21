import { AnalysisMode, AnalysisResult, AiDetectionResult } from '../types/research';
import { InlineFileData } from '../utils/pdfExtractor';
import {
  AI_DETECTION_SYSTEM_PROMPT,
  buildAiDetectionUserPrompt,
  normalizeAiDetectionResult,
} from '../utils/aiDetectionPrompt';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const LEGACY_API_KEY_STORAGE_KEY = 'gemini_key';
const GEMINI_MODEL = 'gemini-4-hydrogen';

export function getStoredApiKey(): string {
  try {
    return (
      localStorage.getItem(API_KEY_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY) ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) return;
  localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
}

function parseGeminiError(status: number, bodyText: string): string {
  try {
    const json = JSON.parse(bodyText);
    const msg = json?.error?.message || '';
    if (status === 400 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key')) {
      return 'مفتاح Gemini API غير صالح أو منتهي الصلاحية. يرجى التأكد من المفتاح في صفحة المفتاح.';
    }
    if (status === 429) {
      return 'تم تجاوز حد الاستخدام المسموح لمفتاح Gemini حالياً (429). يرجى الانتظار قليلاً ثم إعادة المحاولة.';
    }
    if (status === 404) {
      return `النموذج (${GEMINI_MODEL}) غير متاح لهذا المفتاح حالياً.`;
    }
    if (msg) return `خطأ من Gemini API (${status}): ${msg}`;
  } catch {
    // ignore JSON parse errors
  }
  return `تعذر الاتصال بخدمة Gemini API (رمز الخطأ: ${status})`;
}

export async function analyzeResearchWithGemini(
  text: string,
  mode: AnalysisMode,
  apiKey: string,
  inlineData?: InlineFileData
): Promise<AnalysisResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح Gemini API وحفظه في صفحة المفتاح لتحليل الملفات والصور.');
  }

  const hasText = Boolean(text && text.trim().length >= 30);
  if (!hasText && !inlineData) {
    throw new Error('الرجاء رفع ملف (PDF/TXT/DOCX) أو صورة صالحة للتحليل.');
  }

  const analysisTypeNames: Record<string, string> = {
    full: 'تحليل أكاديمي متكامل وشامل (بنية، منهجية، نتائج، نقد، أسئلة دفاع)',
    summary: 'ملخص تنفيذي مركّز ودقيق لأهم مخرجات البحث وأهدافه',
    critical: 'تحليل نقدي منهجي عميق (فحص العينة، الأدوات، التحيزات، التهديدات لصدق النتائج، والفجوات)',
    presentation: 'تحضير متخصص للعرض التقديمي ومناقشة لجنة التحكيم والأطروحة',
    methodology: 'تفكيك تفصيلي للإطار المنهجي والإحصائي للبحث',
  };

  const typeDesc = analysisTypeNames[mode] || analysisTypeNames.full;

  const systemInstruction = `أنت خبير ومحكم أكاديمي مرموق متخصص في تفكيك وتحليل الأبحاث والدراسات العلمية باللغة العربية.
مهمتك: قراءة الملف أو الصورة أو النص البحثي المقدم، واستخراج بنيته العلمية بمنتهى الدقة والموضوعية الأكاديمية.
نوع التحليل المطلوب: ${typeDesc}.

قواعد التحليل:
1. استند فقط إلى ما ورد في الملف/الصورة أو ما يمكن استنباطه منطقياً منه.
2. استخدم لغة عربية أكاديمية فصيحة، واضحة ورصينة.
3. قيّم جودة البحث من 0 إلى 100 بناءً على وضوح المشكلة، تماسك المنهجية، كفاية الأدلة، وموثوقية النتائج.
4. في بنك أسئلة المناقشة: قدّم أسئلة عميقة ومتوقعة قد يطرحها محكم أكاديمي، مع تقديم إرشادات نموذجية للإجابة (الفكرة المحورية، الدليل الأكاديمي، والخلاصة).
5. يجب أن تعيد النتيجة بصيغة JSON مطابقة تماماً للمخطط المحدد.`;

  const parts: Array<Record<string, unknown>> = [];
  if (inlineData) {
    parts.push({
      inlineData: {
        mimeType: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }

  const promptText = hasText
    ? `حلل البحث الأكاديمي التالي بدقة:\n\nنص البحث:\n"""\n${text.slice(0, 35000)}\n"""`
    : 'اقرأ محتوى الملف أو الصورة المرفقة بدقة واستخرج كافة النصوص والبيانات والجداول فيه، ثم حلله أكاديمياً وفق المخطط المحدد.';

  parts.push({ text: promptText });

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      titleSuggestion: {
        type: 'STRING',
        description: 'عنوان أكاديمي مقترح أو مستخرج للبحث',
      },
      type: {
        type: 'STRING',
        description: 'نوع وتصميم البحث (مثل: بحث تجريبي، دراسة حالة، مراجعة منهجية، بحث مسحي وصفي)',
      },
      score: {
        type: 'INTEGER',
        description: 'درجة الرصانة والوضوح الإجمالية من 0 إلى 100',
      },
      scoreBreakdown: {
        type: 'OBJECT',
        properties: {
          methodology: { type: 'INTEGER', description: 'درجة تماسك المنهجية 0-100' },
          clarity: { type: 'INTEGER', description: 'درجة الوضوح والأسلوب العلمي 0-100' },
          evidence: { type: 'INTEGER', description: 'قوة الأدلة والبيانات 0-100' },
          originality: { type: 'INTEGER', description: 'الأصالة والقيمة التطبيقية 0-100' },
        },
        required: ['methodology', 'clarity', 'evidence', 'originality'],
      },
      keywords: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'أهم 6-10 كلمات ومفاهيم مفتاحية أكاديمية مستخرجة من البحث',
      },
      summary: {
        type: 'STRING',
        description: 'الملخص التنفيذي المركز والشامل للبحث',
      },
      goal: {
        type: 'STRING',
        description: 'مشكلة البحث وسؤال الدراسة الرئيسي والفرضيات والأهداف',
      },
      methodology: {
        type: 'OBJECT',
        properties: {
          design: { type: 'STRING', description: 'منهج وتصميم الدراسة' },
          sample: { type: 'STRING', description: 'مجتمع وعينة الدراسة وطريقة الاختيار' },
          tools: { type: 'STRING', description: 'أدوات جمع البيانات (استبيان، اختبار، مقابلة، ملاحظة)' },
          analysis: { type: 'STRING', description: 'أساليب التحليل والمعالجة الإحصائية أو النوعية' },
          limitations: { type: 'STRING', description: 'حدود الدراسة المعلنة أو المستنتجة' },
        },
        required: ['design', 'sample', 'tools', 'analysis'],
      },
      findings: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'أهم 4-6 نتائج علمية بارزة توصل إليها البحث مدعمة بالأرقام أو الدلالات إن وجدت',
      },
      strengths: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'نقاط القوة المنهجية والموضوعية الحقيقية المستخلصة من النص',
      },
      weaknesses: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'نقاط الضعف المنهجية، التحيزات المحتملة، الفجوات البحثية والحدود غير المعالجة',
      },
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING', description: 'نص السؤال المحتمل من المحكم أو لجنة المناقشة' },
            context: { type: 'STRING', description: 'لماذا يطرح المحكم هذا السؤال وما الذي يختبره' },
            recommendedAnswer: {
              type: 'STRING',
              description: 'صيغة الإجابة الدفاعية النموذجية المكونة من: الفكرة، الدليل، والخلاصة',
            },
          },
          required: ['question', 'context', 'recommendedAnswer'],
        },
        description: '4-6 أسئلة مناقشة أكاديمية محتملة مع إرشادات الإجابة الذكية',
      },
      actionPlan: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'خطة عمل مقترحة وتوصيات إجرائية لتطوير البحث أو تطبيقه عملياً',
      },
      presentationPitch: {
        type: 'STRING',
        description: 'ملخص في 60 ثانية لعرض البحث في المؤتمرات أو لجان المناقشة (Elevator Pitch)',
      },
    },
    required: [
      'titleSuggestion',
      'type',
      'score',
      'scoreBreakdown',
      'keywords',
      'summary',
      'goal',
      'methodology',
      'findings',
      'strengths',
      'weaknesses',
      'questions',
      'actionPlan',
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseGeminiError(res.status, errBody));
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('لم يُرجع نموذج Gemini استجابة صالحة. يرجى إعادة المحاولة.');
  }

  try {
    return JSON.parse(rawText) as AnalysisResult;
  } catch {
    throw new Error('تعذر تحليل بنية الاستجابة من Gemini. يرجى المحاولة مرة أخرى.');
  }
}

export async function chatAboutResearchWithGemini(
  researchText: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string,
  inlineData?: InlineFileData
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح Gemini API وحفظه في صفحة المفتاح لاستخدام المحادثة.');
  }

  const systemInstruction = `أنت المساعد الأكاديمي الذكي المخصص لهذا البحث.
لديك محتوى البحث أدناه، ومهمتك الإجابة عن أي سؤال يطرحه الباحث أو الطالب الأكاديمي بدقة علمية واقتباسات دقيقة متى ما أمكن باللغة العربية الفصحى.

${
  researchText
    ? `نص البحث المرجعي:\n"""\n${researchText.slice(0, 30000)}\n"""`
    : 'المرجع الأساسي هو الملف أو الصورة المرفقة في المحادثة.'
}`;

  const firstParts: Array<Record<string, unknown>> = [];
  if (inlineData) {
    firstParts.push({
      inlineData: {
        mimeType: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    {
      role: 'user',
      parts: [...firstParts, { text: question }],
    },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseGeminiError(res.status, errBody));
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('لم يتم استلام إجابة من Gemini.');
  }

  return reply;
}

export async function detectAiContentWithGemini(
  text: string,
  apiKey: string,
  inlineData?: InlineFileData
): Promise<AiDetectionResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح Gemini API وحفظه في صفحة المفاتيح لفحص الملف أو الصورة.');
  }

  const hasText = Boolean(text && text.trim().length >= 30);
  if (!hasText && !inlineData) {
    throw new Error('الرجاء رفع ملف أو صورة صالحة لفحص نسبة الذكاء الاصطناعي.');
  }

  const parts: Array<Record<string, unknown>> = [];
  if (inlineData) {
    parts.push({
      inlineData: {
        mimeType: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }
  parts.push({ text: buildAiDetectionUserPrompt(text) });

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      ai_percentage: { type: 'INTEGER' },
      human_percentage: { type: 'INTEGER' },
      confidence: { type: 'INTEGER' },
      verdict: {
        type: 'STRING',
        enum: ['كتابة بشرية', 'مختلط', 'مولد بالذكاء الاصطناعي'],
      },
      reason: { type: 'STRING' },
      indicators: {
        type: 'OBJECT',
        properties: {
          repetitive_patterns: { type: 'INTEGER' },
          vocabulary_diversity: { type: 'INTEGER' },
          human_errors: { type: 'INTEGER' },
          personal_depth: { type: 'INTEGER' },
        },
        required: [
          'repetitive_patterns',
          'vocabulary_diversity',
          'human_errors',
          'personal_depth',
        ],
      },
    },
    required: [
      'ai_percentage',
      'human_percentage',
      'confidence',
      'verdict',
      'reason',
      'indicators',
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: AI_DETECTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseGeminiError(res.status, errBody));
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('لم يُرجع نموذج Gemini استجابة صالحة لفحص الذكاء الاصطناعي.');
  }

  try {
    return normalizeAiDetectionResult(rawText);
  } catch {
    throw new Error('تعذر تحليل استجابة JSON لفحص الذكاء الاصطناعي من Gemini.');
  }
}
