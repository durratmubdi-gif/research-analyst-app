import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AI_DETECTION_SYSTEM_PROMPT,
  buildAiDetectionUserPrompt,
  normalizeAiDetectionResult,
} from './src/utils/aiDetectionPrompt.ts';
import { normalizeAnalysisResult } from './src/utils/normalizeAnalysis.ts';

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FALLBACK_GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];
const CHAPTER_GENERATION_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
const RETRY_DELAYS_MS = [2000, 4000, 8000];

const ALLOWED_INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

interface ServerInlineData {
  mimeType: string;
  data: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAvailableGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
    process.env.GEMINI_SECONDARY_API_KEY,
  ]
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractRawErrorInfo(err: unknown): { statusCode?: number; text: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  const trimmed = rawMessage.trim();

  // Check error object properties first if SDK attaches status
  const errObj = err as { status?: unknown; code?: unknown } | null;
  let statusCode: number | undefined =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : undefined;

  let text = trimmed;

  // Extract inner error if rawMessage contains JSON (e.g. '{"error":{"code":503,...}}')
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { code?: number; status?: string; message?: string };
        code?: number;
        status?: string;
        message?: string;
      };
      const inner: { code?: number; status?: string; message?: string } = parsed?.error || parsed;
      if (!statusCode && typeof inner?.code === 'number') {
        statusCode = inner.code;
      }
      if (typeof inner?.message === 'string' && inner.message.trim()) {
        text = `${inner.status || ''} ${inner.message}`.trim();
      }
    } catch {
      // keep trimmed text
    }
  }

  return { statusCode, text };
}

function isTransientOverloadError(err: unknown): boolean {
  const { statusCode, text } = extractRawErrorInfo(err);
  if (statusCode === 503 || statusCode === 429) return true;

  const lower = text.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('unavailable') ||
    lower.includes('resource_exhausted') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('try again later') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset')
  );
}

function isModelNotFoundError(err: unknown): boolean {
  const { statusCode, text } = extractRawErrorInfo(err);
  if (statusCode === 404) return true;
  const lower = text.toLowerCase();
  return lower.includes('404') || lower.includes('not_found') || lower.includes('is not found');
}

async function generateGeminiWithResilience(params: {
  contents: unknown;
  config?: Record<string, unknown>;
  modelsPriority?: string[];
}): Promise<{
  response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
  providerUsed: 'gemini';
  modelUsed: string;
}> {
  const apiKeys = getAvailableGeminiKeys();
  if (apiKeys.length === 0) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  const modelsToTry =
    params.modelsPriority && params.modelsPriority.length > 0
      ? params.modelsPriority
      : [PRIMARY_GEMINI_MODEL, ...FALLBACK_GEMINI_MODELS];
  let lastError: unknown = null;

  for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
    const ai = createGeminiClient(apiKeys[keyIdx]);

    for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
      const model = modelsToTry[modelIdx];
      const maxRetries = modelIdx === 0 && keyIdx === 0 ? RETRY_DELAYS_MS.length : 1;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: params.contents as never,
            config: params.config as never,
          });
          return {
            response,
            providerUsed: 'gemini',
            modelUsed: model,
          };
        } catch (err: unknown) {
          lastError = err;

          // If a fallback model isn't available, skip directly to the next fallback model
          if (isModelNotFoundError(err) && modelIdx < modelsToTry.length - 1) {
            break;
          }

          if (!isTransientOverloadError(err)) {
            throw err;
          }

          if (attempt < maxRetries) {
            const delayMs = RETRY_DELAYS_MS[attempt] ?? 2000;
            await sleep(delayMs);
            continue;
          }
        }
      }
    }
  }

  throw lastError || new Error('503 UNAVAILABLE');
}

function sanitizeInlineData(raw: unknown): ServerInlineData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as { mimeType?: unknown; data?: unknown };
  if (typeof candidate.mimeType !== 'string' || typeof candidate.data !== 'string') {
    return undefined;
  }
  const mimeType = candidate.mimeType.trim().toLowerCase();
  const data = candidate.data.trim();
  if (!ALLOWED_INLINE_MIME_TYPES.has(mimeType) || !data) {
    throw new Error('صيغة الملف أو الصورة المرفقة غير مدعومة.');
  }
  return { mimeType, data };
}

function parseServerGeminiError(err: unknown): {
  status: number;
  message: string;
  isTransientOverload: boolean;
} {
  const rawMessage = err instanceof Error ? err.message : String(err || '');

  if (rawMessage === 'MISSING_GEMINI_API_KEY') {
    return {
      status: 500,
      message: 'مفتاح GEMINI_API_KEY غير مضبوط على الخادم. يرجى التحقق من Settings > Secrets.',
      isTransientOverload: false,
    };
  }

  const { statusCode, text } = extractRawErrorInfo(err);
  const lower = text.toLowerCase();

  if (
    statusCode === 503 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return {
      status: 503,
      message:
        'تشهد خوادم Gemini ضغطاً مؤقتاً مرتفعاً في هذه اللحظة. قام النظام بإعادة المحاولة والتحويل التلقائي، يرجى المحاولة مرة أخرى بعد قليل أو استخدام التحليل بالنص عبر GPT-4o.',
      isTransientOverload: true,
    };
  }

  if (
    statusCode === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      status: 429,
      message:
        'خوادم الذكاء الاصطناعي مزدحمة مؤقتاً أو تم تجاوز حد الطلبات اللحظي (429). حاول النظام إعادة المحاولة تلقائياً، يرجى الانتظار بضع ثوانٍ ثم إعادة المحاولة.',
      isTransientOverload: true,
    };
  }

  if (
    statusCode === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('api key')
  ) {
    return {
      status: 400,
      message: 'مفتاح Gemini API على الخادم غير صالح أو غير متاح. يرجى التحقق من Settings > Secrets.',
      isTransientOverload: false,
    };
  }

  if (isModelNotFoundError(err)) {
    return {
      status: 404,
      message: 'النموذج المطلوب غير متاح حالياً على الخادم.',
      isTransientOverload: false,
    };
  }

  // Never expose raw JSON payloads to the user
  const safeFallbackText =
    text && !text.trim().startsWith('{')
      ? text
      : 'تعذر الاتصال بخدمة Gemini عبر الخادم حالياً. يرجى المحاولة مجدداً بعد لحظات.';

  return {
    status: statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: safeFallbackText,
    isTransientOverload: false,
  };
}

const app = express();
app.use(express.json({ limit: '25mb' }));

// 1. Academic Research Analysis via Gemini (Server-Side)
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const body = req.body as {
      text?: unknown;
      mode?: unknown;
      inlineData?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text : '';
    const mode = typeof body.mode === 'string' ? body.mode : 'full';
    const inlineData = sanitizeInlineData(body.inlineData);

    const hasText = Boolean(text && text.trim().length >= 30);
    if (!hasText && !inlineData) {
      res.status(400).json({ error: 'الرجاء رفع ملف (PDF/TXT/DOCX) أو صورة صالحة للتحليل.' });
      return;
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

    const parts: Array<{ inlineData: ServerInlineData } | { text: string }> = [];
    if (inlineData) {
      parts.push({ inlineData });
    }

    const promptText = hasText
      ? `حلل البحث الأكاديمي التالي بدقة:\n\nنص البحث:\n"""\n${text.slice(0, 35000)}\n"""`
      : 'اقرأ محتوى الملف أو الصورة المرفقة بدقة واستخرج كافة النصوص والبيانات والجداول فيه، ثم حلله أكاديمياً وفق المخطط المحدد.';

    parts.push({ text: promptText });

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titleSuggestion: {
              type: Type.STRING,
              description: 'عنوان أكاديمي مقترح أو مستخرج للبحث',
            },
            type: {
              type: Type.STRING,
              description: 'نوع وتصميم البحث (مثل: بحث تجريبي، دراسة حالة، مراجعة منهجية، بحث مسحي وصفي)',
            },
            score: {
              type: Type.INTEGER,
              description: 'درجة الرصانة والوضوح الإجمالية من 0 إلى 100',
            },
            scoreBreakdown: {
              type: Type.OBJECT,
              properties: {
                methodology: { type: Type.INTEGER, description: 'درجة تماسك المنهجية 0-100' },
                clarity: { type: Type.INTEGER, description: 'درجة الوضوح والأسلوب العلمي 0-100' },
                evidence: { type: Type.INTEGER, description: 'قوة الأدلة والبيانات 0-100' },
                originality: { type: Type.INTEGER, description: 'الأصالة والقيمة التطبيقية 0-100' },
              },
              required: ['methodology', 'clarity', 'evidence', 'originality'],
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'أهم 6-10 كلمات ومفاهيم مفتاحية أكاديمية مستخرجة من البحث',
            },
            summary: {
              type: Type.STRING,
              description: 'الملخص التنفيذي المركز والشامل للبحث',
            },
            goal: {
              type: Type.STRING,
              description: 'مشكلة البحث وسؤال الدراسة الرئيسي والفرضيات والأهداف',
            },
            methodology: {
              type: Type.OBJECT,
              properties: {
                design: { type: Type.STRING, description: 'منهج وتصميم الدراسة' },
                sample: { type: Type.STRING, description: 'مجتمع وعينة الدراسة وطريقة الاختيار' },
                tools: { type: Type.STRING, description: 'أدوات جمع البيانات (استبيان، اختبار، مقابلة، ملاحظة)' },
                analysis: { type: Type.STRING, description: 'أساليب التحليل والمعالجة الإحصائية أو النوعية' },
                limitations: { type: Type.STRING, description: 'حدود الدراسة المعلنة أو المستنتجة' },
              },
              required: ['design', 'sample', 'tools', 'analysis'],
            },
            findings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'أهم 4-6 نتائج علمية بارزة توصل إليها البحث مدعمة بالأرقام أو الدلالات إن وجدت',
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'نقاط القوة المنهجية والموضوعية الحقيقية المستخلصة من النص',
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'نقاط الضعف المنهجية، التحيزات المحتملة، الفجوات البحثية والحدود غير المعالجة',
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: 'نص السؤال المحتمل من المحكم أو لجنة المناقشة' },
                  context: { type: Type.STRING, description: 'لماذا يطرح المحكم هذا السؤال وما الذي يختبره' },
                  recommendedAnswer: {
                    type: Type.STRING,
                    description: 'صيغة الإجابة الدفاعية النموذجية المكونة من: الفكرة، الدليل، والخلاصة',
                  },
                },
                required: ['question', 'context', 'recommendedAnswer'],
              },
              description: '4-6 أسئلة مناقشة أكاديمية محتملة مع إرشادات الإجابة الذكية',
            },
            actionPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'خطة عمل مقترحة وتوصيات إجرائية لتطوير البحث أو تطبيقه عملياً',
            },
            presentationPitch: {
              type: Type.STRING,
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
        },
      },
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      res.status(502).json({ error: 'لم يُرجع نموذج Gemini استجابة صالحة. يرجى إعادة المحاولة.' });
      return;
    }

    const analysis = normalizeAnalysisResult(JSON.parse(rawText));
    res.json({ analysis, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

// 2. Interactive Research Chat via Gemini (Server-Side)
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const body = req.body as {
      researchText?: unknown;
      question?: unknown;
      history?: unknown;
      inlineData?: unknown;
    };

    const researchText = typeof body.researchText === 'string' ? body.researchText : '';
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const inlineData = sanitizeInlineData(body.inlineData);

    if (!question) {
      res.status(400).json({ error: 'الرجاء كتابة سؤال للمحادثة.' });
      return;
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const formattedHistory = rawHistory
      .filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(
            m &&
              typeof m === 'object' &&
              ('role' in m) &&
              ('content' in m) &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
          )
      )
      .slice(-8)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = `أنت المساعد الأكاديمي الذكي المخصص لهذا البحث.
لديك محتوى البحث أدناه، ومهمتك الإجابة عن أي سؤال يطرحه الباحث أو الطالب الأكاديمي بدقة علمية واقتباسات دقيقة متى ما أمكن باللغة العربية الفصحى.

${
  researchText
    ? `نص البحث المرجعي:\n"""\n${researchText.slice(0, 30000)}\n"""`
    : 'المرجع الأساسي هو الملف أو الصورة المرفقة في المحادثة.'
}`;

    const userParts: Array<{ inlineData: ServerInlineData } | { text: string }> = [];
    if (inlineData) {
      userParts.push({ inlineData });
    }
    userParts.push({ text: question });

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: userParts,
      },
    ];

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = (response.text || '').trim();
    if (!reply) {
      res.status(502).json({ error: 'لم يتم استلام إجابة من Gemini.' });
      return;
    }

    res.json({ reply, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

// 3. AI-Text Detection via Gemini (Server-Side)
app.post('/api/gemini/detect-ai', async (req, res) => {
  try {
    const body = req.body as {
      text?: unknown;
      inlineData?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text : '';
    const inlineData = sanitizeInlineData(body.inlineData);

    const hasText = Boolean(text && text.trim().length >= 30);
    if (!hasText && !inlineData) {
      res.status(400).json({ error: 'الرجاء رفع ملف أو صورة صالحة لفحص نسبة الذكاء الاصطناعي.' });
      return;
    }

    const parts: Array<{ inlineData: ServerInlineData } | { text: string }> = [];
    if (inlineData) {
      parts.push({ inlineData });
    }
    parts.push({ text: buildAiDetectionUserPrompt(text) });

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents: { parts },
      config: {
        systemInstruction: AI_DETECTION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ai_percentage: { type: Type.INTEGER },
            human_percentage: { type: Type.INTEGER },
            confidence: { type: Type.INTEGER },
            repetitive_patterns: { type: Type.INTEGER },
            vocabulary_diversity: { type: Type.INTEGER },
            human_errors: { type: Type.INTEGER },
            personal_depth: { type: Type.INTEGER },
            manipulation_attempt: { type: Type.BOOLEAN },
            verdict: {
              type: Type.STRING,
              enum: ['AI Generated', 'Human Written', 'Mixed'],
            },
          },
          required: [
            'ai_percentage',
            'human_percentage',
            'confidence',
            'repetitive_patterns',
            'vocabulary_diversity',
            'human_errors',
            'personal_depth',
            'manipulation_attempt',
            'verdict',
          ],
        },
      },
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      res.status(502).json({ error: 'لم يُرجع نموذج Gemini استجابة صالحة لفحص الذكاء الاصطناعي.' });
      return;
    }

    const detection = normalizeAiDetectionResult(rawText);
    res.json({ detection, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

// 4. Step 1: Generate Editable Research Outline (Server-Side Gemini)
app.post('/api/gemini/outline', async (req, res) => {
  try {
    const body = req.body as { title?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (title.length < 5) {
      res.status(400).json({ error: 'الرجاء إدخال عنوان بحث واضح لا يقل عن 5 أحرف.' });
      return;
    }

    const systemInstruction = `You are an expert academic research planner. Based on the user's research title, generate a clear, logical, and editable research outline (main sections and 2-3 bullet points under each). 
Keep the points concise and analytical—do not write full paragraphs yet. At the end of each section, add a brief placeholder prompt like "[Add your personal insight, local example, or specific data here]" to encourage the researcher to inject their own perspective before full drafting. Output in the exact same language as the user's title.`;

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents: `Research Title:\n"${title.slice(0, 1000)}"`,
      config: {
        systemInstruction,
      },
    });

    const outline = (response.text || '').trim();
    if (!outline) {
      res.status(502).json({ error: 'لم يُرجع النموذج مخططاً صالحاً. يرجى المحاولة مرة أخرى.' });
      return;
    }

    res.json({ outline, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

// 5. Step 2: Write Final Human-Style Research Paper from Modified Outline (Server-Side Gemini)
app.post('/api/gemini/draft-paper', async (req, res) => {
  try {
    const body = req.body as {
      title?: unknown;
      outline?: unknown;
      personalNotes?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const outline = typeof body.outline === 'string' ? body.outline.trim() : '';
    const personalNotes =
      typeof body.personalNotes === 'string' ? body.personalNotes.trim() : '';

    if (outline.length < 20) {
      res.status(400).json({ error: 'الرجاء توفير مخطط البحث قبل صياغة الورقة النهائية.' });
      return;
    }

    const systemInstruction = `You are a senior academic researcher and editor writing a final research paper based strictly on the user's modified outline and personal notes. 

To ensure the writing reads naturally like an authentic human-authored paper and avoids robotic AI patterns, strictly follow these rules:
1. Anchor around user inputs: Prioritize and weave the user's custom notes, examples, and modified structure into the core of each paragraph.
2. High Burstiness (Sentence Variety): Mix short, direct, declarative sentences (6-10 words) with longer, complex analytical sentences (20-30 words). Never write three sentences of similar length in a row.
3. Zero AI Clichés: Strictly avoid overused transitional filler and buzzwords (such as: "In conclusion", "Furthermore", "Moreover", "It is crucial to note", "delve into", "tapestry", "testament", "navigating the landscape", "in today's fast-paced world", or their direct Arabic equivalents like "علاوة على ذلك", "في ختام المطاف", "تجدر الإشارة إلى", "مما لا شك فيه").
4. Asymmetric Flow: Vary how paragraphs begin. Start some with a direct claim, others with evidence or context, and avoid symmetrical bulleted lists unless strictly necessary for data.
5. Academic Rigor without Fluff: Maintain formal, objective academic tone, ensuring logical transitions through meaning rather than mechanical linking words.

Write the complete text in the same language as the outline provided.`;

    const promptParts: string[] = [];
    if (title) {
      promptParts.push(`Research Title:\n${title.slice(0, 1000)}`);
    }
    promptParts.push(`Modified Research Outline:\n"""\n${outline.slice(0, 25000)}\n"""`);
    if (personalNotes) {
      promptParts.push(
        `Researcher's Additional Personal Notes, Local Examples, and Data:\n"""\n${personalNotes.slice(0, 12000)}\n"""`
      );
    }

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents: promptParts.join('\n\n'),
      config: {
        systemInstruction,
      },
    });

    const paper = (response.text || '').trim();
    if (!paper) {
      res.status(502).json({ error: 'لم يُرجع النموذج مسودة البحث. يرجى المحاولة مرة أخرى.' });
      return;
    }

    res.json({ paper, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

// 6. Write One Chapter of a 45-Page University-Level Strategic Audit Report (Server-Side Gemini)
app.post('/api/gemini/strategic-audit-chapter', async (req, res) => {
  try {
    const body = req.body as {
      companyName?: unknown;
      targetChapter?: unknown;
      chapterInstructions?: unknown;
      companyDataAndRubric?: unknown;
      researcherNotes?: unknown;
      previousChaptersContext?: unknown;
      language?: unknown;
    };

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const targetChapter =
      typeof body.targetChapter === 'string' ? body.targetChapter.trim() : '';
    const chapterInstructions =
      typeof body.chapterInstructions === 'string' ? body.chapterInstructions.trim() : '';
    const companyDataAndRubric =
      typeof body.companyDataAndRubric === 'string' ? body.companyDataAndRubric.trim() : '';
    const researcherNotes =
      typeof body.researcherNotes === 'string' ? body.researcherNotes.trim() : '';
    const previousChaptersContext =
      typeof body.previousChaptersContext === 'string'
        ? body.previousChaptersContext.trim()
        : '';
    const language = typeof body.language === 'string' ? body.language.trim() : 'auto';

    if (companyName.length < 2) {
      res.status(400).json({ error: 'الرجاء إدخال اسم الشركة أو المؤسسة المستهدفة.' });
      return;
    }

    if (targetChapter.length < 3) {
      res.status(400).json({ error: 'الرجاء تحديد اسم أو رقم الفصل المطلوب كتابته.' });
      return;
    }

    const systemInstruction = `You are a senior Strategic Management Professor and Academic Research Architect. Your task is to write ONE specific chapter at a time of a comprehensive, 45-page university-level Strategic Audit Report, strictly adhering to the provided assignment guidelines and rubric.

CRITICAL RULES FOR THIS CHAPTER:
1. Depth & Length: Do NOT summarize or rush. Write in exhaustive analytical depth (~2,000 to 2,500 words for this single section) using formal academic prose, rich critical thinking, and detailed explanations so the complete multi-chapter report reaches ~45 pages.
2. Matrix & Data Consistency: Ensure every factor, weight, rating, and financial figure aligns strictly with the company data and previous chapters. Whenever financial or market data is missing, state clear, realistic assumptions explicitly as required by academic audit standards.
3. Structured Tables & Numbering: Format all analytical matrices (PESTEL, Porter's 5 Forces, EFE, CPM, IFE, BCG, SWOT, SPACE, IE, QSPM) as well-structured Markdown tables. Number every table and figure sequentially (e.g., Table 3.1: EFE Matrix) with descriptive titles, units of measure, and data sources.
4. Human-Like Academic Style (Low AI Footprint):
   - Anchor every analytical section around the researcher's specific notes, local examples, and company data provided in the prompt.
   - Vary sentence length deliberately: combine crisp, direct analytical claims (7–12 words) with deep, multi-clause evaluations (22–32 words).
   - Eliminate robotic AI transitions (avoid "Furthermore", "Moreover", "In conclusion", "It is crucial to note", "delve into", "tapestry"). Use logical, evidence-driven transitions instead.
5. Citations: Include proper APA in-text citations and list references at the end of the section.

Output ONLY the requested chapter in full detail, ready to be appended to the final research document.`;

    const languageDirective =
      language === 'ar'
        ? 'Output Language: Write the entire chapter, headings, tables, and academic prose in formal Academic Arabic (with standard English matrix acronyms/terms such as EFE, IFE, SWOT, SPACE, QSPM alongside Arabic where appropriate).'
        : language === 'en'
          ? 'Output Language: Write the entire chapter, headings, tables, and academic prose in formal Academic English.'
          : 'Output Language: Match the primary language of the target chapter title, company data, and researcher notes.';

    const promptSections: string[] = [
      `Target Company / Organization:\n${companyName.slice(0, 500)}`,
      `Target Chapter to Write NOW (Write ONLY this chapter in exhaustive 2,000–2,500 word depth):\n${targetChapter.slice(0, 1000)}`,
      languageDirective,
    ];

    if (chapterInstructions) {
      promptSections.push(
        `Chapter Specific Scope & Required Analytical Deliverables:\n${chapterInstructions.slice(0, 3000)}`
      );
    }

    if (companyDataAndRubric) {
      promptSections.push(
        `Company Financial/Market Data & Assignment Guidelines / Rubric:\n"""\n${companyDataAndRubric.slice(0, 20000)}\n"""`
      );
    }

    if (previousChaptersContext) {
      const compactPrevContext = previousChaptersContext
        .split(/\s+/)
        .slice(0, 1250)
        .join(' ');
      promptSections.push(
        `Previous Chapters Key Metrics & Matrices Digest (MUST stay strictly consistent with these figures):\n"""\n${compactPrevContext}\n"""`
      );
    }

    if (researcherNotes) {
      promptSections.push(
        `Researcher's Specific Notes, Local Examples, & Explicit Assumptions (Anchor your analysis around these):\n"""\n${researcherNotes.slice(0, 12000)}\n"""`
      );
    }

    const { response, providerUsed, modelUsed } = await generateGeminiWithResilience({
      contents: promptSections.join('\n\n'),
      modelsPriority: CHAPTER_GENERATION_MODELS,
      config: {
        systemInstruction,
        maxOutputTokens: 16384,
      },
    });

    const chapter = (response.text || '').trim();
    if (!chapter) {
      res.status(502).json({ error: 'لم يُرجع النموذج محتوى الفصل المطلوب. يرجى المحاولة مرة أخرى.' });
      return;
    }

    res.json({ chapter, providerUsed, modelUsed });
  } catch (err: unknown) {
    const { status, message, isTransientOverload } = parseServerGeminiError(err);
    res.status(status).json({ error: message, retriedOnServer: true, isTransientOverload });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
