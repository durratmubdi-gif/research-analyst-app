import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '20mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for cleaning text from URLs
function extractTextFromHtml(html: string): string {
  // Simple HTML to text extraction
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. URL Fetch Route
app.post('/api/fetch-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      res.status(400).json({ error: 'الرجاء إدخال رابط صحيح يبدأ بـ http أو https' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AcademicResearchAnalyzer/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(response.status).json({ error: `تعذر جلب المحتوى من الرابط (${response.status})` });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    let text = body;
    if (contentType.includes('html')) {
      text = extractTextFromHtml(body);
    }

    if (text.length < 50) {
      res.status(400).json({ error: 'المحتوى المستخرج من الرابط قصير جداً أو غير متاح مباشرة. يرجى نسخ النص ولصقه.' });
      return;
    }

    res.json({ text: text.slice(0, 60000), title: url });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('URL Fetch Error:', error);
    res.status(500).json({
      error: error.name === 'AbortError' ? 'انتهت مهلة جلب الرابط' : 'فشل الاتصال بالرابط، الرجاء نسخ النص ولصقه مباشرة',
    });
  }
});

// 2. Academic Analysis Route using Gemini AI
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { text, type = 'full' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      res.status(400).json({ error: 'النص المدخل قصير جداً للتحليل الأكاديمي. الرجاء إدخال فقرة كاملة أو ورقة بحثية.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'لم يتم العثور على مفتاح GEMINI_API_KEY في بيئة التشغيل. يرجى التأكد من إضافته في إعدادات المنصة.',
      });
      return;
    }

    const analysisTypeNames: Record<string, string> = {
      full: 'تحليل أكاديمي متكامل وشامل (بنية، منهجية، نتائج، نقد، أسئلة دفاع)',
      summary: 'ملخص تنفيذي مركّز ودقيق لأهم مخرجات البحث وأهدافه',
      critical: 'تحليل نقدي منهجي عميق (فحص العينة، الأدوات، التحيزات، التهديدات لصدق النتائج، والفجوات)',
      presentation: 'تحضير متخصص للعرض التقديمي ومناقشة لجنة التحكيم والأطروحة',
      methodology: 'تفكيك تفصيلي للإطار المنهجي والإحصائي للبحث',
    };

    const typeDesc = analysisTypeNames[type] || analysisTypeNames.full;

    const systemInstruction = `أنت خبير ومحكم أكاديمي مرموق متخصص في تفكيك وتحليل الأبحاث والدراسات العلمية باللغة العربية.
مهمتك: قراءة النص البحثي المقدم، واستخراج بنيته العلمية بمنتهى الدقة والموضوعية الأكاديمية.
نوع التحليل المطلوب: ${typeDesc}.

قواعد التحليل:
1. استند فقط إلى ما ورد في النص أو ما يمكن استنباطه منطقياً منه.
2. استخدم لغة عربية أكاديمية فصيحة، واضحة ورصينة.
3. قيّم جودة البحث من 0 إلى 100 بناءً على وضوح المشكلة، تماسك المنهجية، كفاية الأدلة، وموثوقية النتائج.
4. في بنك أسئلة المناقشة: قدّم أسئلة عميقة ومتوقعة قد يطرحها محكم أكاديمي، مع تقديم إرشادات نموذجية للإجابة (الفكرة المحورية، الدليل الأكاديمي، والخلاصة).
5. يجب أن تعيد النتيجة بصيغة JSON مطابقة تماماً للمخطط المحدد.`;

    const prompt = `حلل البحث الأكاديمي التالي بدقة:

نص البحث:
"""
${text.slice(0, 35000)}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
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
              description: 'نوع وتصميم البحث (مثل: بحث تجريبي، دراسة حالة، مراجعة منهجية، بحث مسحي وصفي، دراسة شبه تجريبية، بحث نوعي)',
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
                  recommendedAnswer: { type: Type.STRING, description: 'صيغة الإجابة الدفاعية النموذجية المكونة من: الفكرة، الدليل، والخلاصة' },
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

    const rawText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', rawText, parseError);
      res.status(500).json({ error: 'حدث خطأ في معالجة إجابة نموذج الذكاء الاصطناعي. يرجى إعادة المحاولة.' });
      return;
    }

    res.json({
      success: true,
      analysis: parsedResult,
      meta: {
        charCount: text.length,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Gemini Analysis Error:', error);
    res.status(500).json({
      error: error.message || 'حدث خطأ أثناء الاتصال بنموذج Gemini AI. يرجى المحاولة مرة أخرى.',
    });
  }
});

// 3. Interactive Follow-Up Chat about the Paper
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { researchText, question, history = [] } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'السؤال مطلوب' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'مفتاح Gemini API غير مهيأ' });
      return;
    }

    const systemInstruction = `أنت المساعد الأكاديمي الذكي المخصص لهذا البحث.
لديك النص الكامل للبحث أدناه، ومهمتك الإجابة عن أي سؤال يطرحه الباحث أو الطالب الأكاديمي بدقة علمية واقتباسات دقيقة من النص متى ما أمكن.
إذا كان السؤال يطلب تحضيراً لشرائح عرض، صياغة فرضيات بديلة، مقترحات بحثية مستقبلية، أو نقد نقطة معينة، قدم إجابة منظمة أكاديمية غنية وعملية باللغة العربية الفصحى.

نص البحث المرجعي:
"""
${(researchText || '').slice(0, 30000)}
"""`;

    // Format previous history
    const contextPrompt = `سؤال المستخدم: ${question}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contextPrompt,
      config: {
        systemInstruction,
      },
    });

    res.json({
      reply: response.text || 'لا توجد إجابة متاحة حالياً.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Chat Error:', error);
    res.status(500).json({
      error: error.message || 'حدث خطأ أثناء الإجابة عن السؤال.',
    });
  }
});

// Vite middleware or Static files handling
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Research Analyzer server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
