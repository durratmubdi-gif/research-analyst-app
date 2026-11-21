import { AnalysisMode, AnalysisResult, AiDetectionResult } from '../types/research';
import {
  AI_DETECTION_SYSTEM_PROMPT,
  buildAiDetectionUserPrompt,
  normalizeAiDetectionResult,
} from '../utils/aiDetectionPrompt';
import { normalizeAnalysisResult } from '../utils/normalizeAnalysis';

const OPENAI_KEY_STORAGE_KEY = 'openai_api_key';
const OPENAI_MODEL = 'gpt-4o';

export function getStoredOpenAiKey(): string {
  try {
    return (localStorage.getItem(OPENAI_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveOpenAiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) return;
  localStorage.setItem(OPENAI_KEY_STORAGE_KEY, trimmed);
}

export function clearStoredOpenAiKey(): void {
  localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
}

function parseOpenAiError(status: number, bodyText: string): string {
  try {
    const json = JSON.parse(bodyText);
    const msg = json?.error?.message || '';
    if (status === 401 || msg.toLowerCase().includes('incorrect api key') || msg.toLowerCase().includes('invalid_api_key')) {
      return 'مفتاح OpenAI API غير صالح أو منتهي الصلاحية. يرجى التأكد من المفتاح في صفحة المفتاح.';
    }
    if (status === 429) {
      return 'تم تجاوز حد الاستخدام أو الرصيد المتاح لمفتاح OpenAI حالياً (429). يرجى الانتظار قليلاً ثم إعادة المحاولة.';
    }
    if (status === 503) {
      return 'تشهد خوادم OpenAI ضغطاً مؤقتاً حالياً (503). يرجى إعادة المحاولة بعد قليل.';
    }
    if (msg) return `تعذر إتمام الطلب عبر GPT-4o (${status}): ${msg}`;
  } catch {
    // ignore JSON parse errors
  }
  return `تعذر الاتصال بخدمة OpenAI GPT-4o (رمز الخطأ: ${status})`;
}

export async function analyzeResearchWithOpenAI(
  text: string,
  mode: AnalysisMode,
  apiKey: string
): Promise<AnalysisResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح OpenAI API وحفظه في صفحة المفتاح لتحليل النصوص الملصوقة عبر GPT-4o.');
  }

  if (!text || text.trim().length < 40) {
    throw new Error('النص المدخل قصير جداً للتحليل الأكاديمي. الرجاء إدخال فقرة كاملة أو ورقة بحثية.');
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
مهمتك: قراءة النص البحثي المقدم، واستخراج بنيته العلمية بمنتهى الدقة والموضوعية الأكاديمية.
نوع التحليل المطلوب: ${typeDesc}.

قواعد التحليل:
1. استند فقط إلى ما ورد في النص أو ما يمكن استنباطه منطقياً منه.
2. استخدم لغة عربية أكاديمية فصيحة، واضحة ورصينة.
3. قيّم جودة البحث من 0 إلى 100 بناءً على وضوح المشكلة، تماسك المنهجية، كفاية الأدلة، وموثوقية النتائج.
4. يجب أن تعيد النتيجة بصيغة JSON صالحة فقط بدون أي نص خارج JSON، وبنفس أسماء الحقول التالية حرفياً:
{
  "titleSuggestion": "عنوان أكاديمي مقترح أو مستخرج للبحث",
  "type": "نوع وتصميم البحث",
  "score": 85,
  "scoreBreakdown": {
    "methodology": 85,
    "clarity": 85,
    "evidence": 85,
    "originality": 85
  },
  "keywords": ["كلمة1", "كلمة2"],
  "summary": "الملخص التنفيذي المركز والشامل للبحث",
  "goal": "مشكلة البحث وسؤال الدراسة الرئيسي والفرضيات والأهداف",
  "methodology": {
    "design": "منهج وتصميم الدراسة",
    "sample": "مجتمع وعينة الدراسة وطريقة الاختيار",
    "tools": "أدوات جمع البيانات",
    "analysis": "أساليب التحليل والمعالجة الإحصائية أو النوعية",
    "limitations": "حدود الدراسة المعلنة أو المستنتجة"
  },
  "findings": ["النتيجة 1", "النتيجة 2"],
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
  "questions": [
    {
      "question": "سؤال مناقشة متوقع",
      "context": "ما يختبره المحكم في هذا السؤال",
      "recommendedAnswer": "الفكرة: ... الدليل: ... الخلاصة: ..."
    }
  ],
  "actionPlan": ["خطوة 1", "خطوة 2"],
  "presentationPitch": "ملخص العرض التقديمي في 60 ثانية"
}`;

  const prompt = `حلل البحث الأكاديمي التالي بدقة وفق مخطط JSON المحدد:

نص البحث:
"""
${text.slice(0, 35000)}
"""`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseOpenAiError(res.status, errBody));
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('لم يُرجع نموذج GPT-4o استجابة صالحة. يرجى إعادة المحاولة.');
  }

  try {
    return normalizeAnalysisResult(JSON.parse(rawText));
  } catch {
    throw new Error('تعذر تحليل بنية الاستجابة من GPT-4o. يرجى المحاولة مرة أخرى.');
  }
}

export async function chatAboutResearchWithOpenAI(
  researchText: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح OpenAI API في صفحة المفتاح لاستخدام المحادثة.');
  }

  const systemInstruction = `أنت المساعد الأكاديمي الذكي المخصص لهذا البحث.
لديك النص الكامل للبحث أدناه، ومهمتك الإجابة عن أي سؤال يطرحه الباحث أو الطالب الأكاديمي بدقة علمية واقتباسات دقيقة من النص متى ما أمكن باللغة العربية الفصحى.

نص البحث المرجعي:
"""
${(researchText || '').slice(0, 30000)}
"""`;

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseOpenAiError(res.status, errBody));
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('لم يتم استلام إجابة من GPT-4o.');
  }

  return reply;
}

export async function detectAiContentWithOpenAI(
  text: string,
  apiKey: string
): Promise<AiDetectionResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('الرجاء إدخال مفتاح OpenAI API وحفظه في صفحة المفاتيح لفحص النص عبر GPT-4o.');
  }

  if (!text || text.trim().length < 40) {
    throw new Error('النص المدخل قصير جداً لفحص نسبة الذكاء الاصطناعي. الرجاء إدخال فقرة أو نص أطول.');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AI_DETECTION_SYSTEM_PROMPT },
        { role: 'user', content: buildAiDetectionUserPrompt(text) },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseOpenAiError(res.status, errBody));
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('لم يُرجع نموذج GPT-4o استجابة صالحة لفحص الذكاء الاصطناعي.');
  }

  try {
    return normalizeAiDetectionResult(rawText);
  } catch {
    throw new Error('تعذر تحليل استجابة JSON لفحص الذكاء الاصطناعي من GPT-4o.');
  }
}

export async function generateTextWithOpenAIFallback(params: {
  systemInstruction: string;
  userPrompt: string;
  apiKey: string;
}): Promise<string> {
  const cleanKey = params.apiKey.trim();
  if (!cleanKey) {
    throw new Error('مفتاح OpenAI API غير متوفر للتحويل البديل.');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseOpenAiError(res.status, errBody));
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('لم يُرجع نموذج GPT-4o نصاً صالحاً.');
  }

  return content.trim();
}

