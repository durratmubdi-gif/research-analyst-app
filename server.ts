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
const GEMINI_MODEL = 'gemini-4-hydrogen';

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

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

function parseServerGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || '');

  if (rawMessage === 'MISSING_GEMINI_API_KEY') {
    return {
      status: 500,
      message: 'مفتاح GEMINI_API_KEY غير مضبوط على الخادم. يرجى التحقق من Settings > Secrets.',
    };
  }

  if (
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('403') ||
    rawMessage.includes('400') ||
    rawMessage.toLowerCase().includes('api key')
  ) {
    return {
      status: 400,
      message: 'مفتاح Gemini API على الخادم غير صالح أو غير متاح. يرجى التحقق من Settings > Secrets.',
    };
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      message: 'تم تجاوز حد الاستخدام المسموح لخدمة Gemini حالياً (429). يرجى الانتظار قليلاً ثم إعادة المحاولة.',
    };
  }

  if (rawMessage.includes('NOT_FOUND') || rawMessage.includes('404')) {
    return {
      status: 404,
      message: `النموذج (${GEMINI_MODEL}) غير متاح حالياً.`,
    };
  }

  return {
    status: 500,
    message: rawMessage || 'تعذر الاتصال بخدمة Gemini عبر الخادم. يرجى المحاولة لاحقاً.',
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

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    res.json({ analysis });
  } catch (err: unknown) {
    const { status, message } = parseServerGeminiError(err);
    res.status(status).json({ error: message });
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

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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

    res.json({ reply });
  } catch (err: unknown) {
    const { status, message } = parseServerGeminiError(err);
    res.status(status).json({ error: message });
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

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    res.json({ detection });
  } catch (err: unknown) {
    const { status, message } = parseServerGeminiError(err);
    res.status(status).json({ error: message });
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
