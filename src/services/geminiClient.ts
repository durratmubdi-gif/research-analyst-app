import { AnalysisMode, AnalysisResult, AiDetectionResult } from '../types/research';
import { InlineFileData } from '../utils/pdfExtractor';
import { normalizeAnalysisResult } from '../utils/normalizeAnalysis';
import {
  AI_DETECTION_SYSTEM_PROMPT,
  buildAiDetectionUserPrompt,
  normalizeAiDetectionResult,
} from '../utils/aiDetectionPrompt';
import {
  analyzeResearchWithOpenAI,
  chatAboutResearchWithOpenAI,
  detectAiContentWithOpenAI,
  generateTextWithOpenAIFallback,
  getStoredOpenAiKey,
} from './openaiClient';

const GEMINI_KEY_STORAGE_KEY = 'gemini_api_key';
const CLIENT_RETRY_DELAYS_MS = [2000, 4000, 8000];
const DIRECT_BROWSER_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'];

let backendApiUnavailable = false;

export interface ExecutionMetadata {
  providerUsed: 'gemini' | 'openai';
  modelUsed: string;
}

export interface GeneratedTextWithMeta extends ExecutionMetadata {
  text: string;
}

export function getStoredGeminiKey(): string {
  try {
    return (localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveGeminiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
  } catch {
    // ignore storage restrictions
  }
}

export function clearStoredGeminiKey(): void {
  try {
    localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
  } catch {
    // ignore storage restrictions
  }
}

export function isStaticHostingEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    window.location.protocol === 'file:'
  );
}

class BackendUnavailableError extends Error {
  constructor(message = 'BACKEND_UNAVAILABLE') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

class GeminiRequestError extends Error {
  status?: number;
  isTransientOverload: boolean;

  constructor(message: string, status?: number, isTransientOverload = false) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
    this.isTransientOverload = isTransientOverload;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeInlineData(inlineData?: InlineFileData) {
  if (!inlineData) return undefined;
  return {
    mimeType: inlineData.mimeType,
    data: inlineData.data,
  };
}

function formatFriendlyServerError(
  status: number,
  rawText: string,
  parsed: { error?: string | { message?: string; code?: number }; isTransientOverload?: boolean } | null
): { message: string; isTransientOverload: boolean } {
  const serverMessage =
    typeof parsed?.error === 'string'
      ? parsed.error.trim()
      : typeof parsed?.error === 'object' && typeof parsed.error?.message === 'string'
        ? parsed.error.message.trim()
        : '';
  const lowerCombined = `${serverMessage} ${rawText}`.toLowerCase();

  const is503 =
    status === 503 ||
    lowerCombined.includes('503') ||
    lowerCombined.includes('unavailable') ||
    lowerCombined.includes('high demand') ||
    lowerCombined.includes('overloaded');

  const is429 =
    status === 429 ||
    lowerCombined.includes('429') ||
    lowerCombined.includes('resource_exhausted') ||
    lowerCombined.includes('quota') ||
    lowerCombined.includes('rate limit');

  const isAuthError =
    status === 400 ||
    status === 401 ||
    status === 403 ||
    lowerCombined.includes('api_key_invalid') ||
    lowerCombined.includes('api key not valid') ||
    lowerCombined.includes('permission_denied');

  const isTransient = Boolean(parsed?.isTransientOverload) || is503 || is429;

  if (isAuthError && lowerCombined.includes('api')) {
    return {
      message:
        'مفتاح Gemini API المدخل غير صالح أو لا يمتلك صلاحية. يرجى التحقق من المفتاح في «إعدادات مفتاح API».',
      isTransientOverload: false,
    };
  }

  if (serverMessage && !serverMessage.startsWith('{') && !serverMessage.startsWith('<')) {
    return { message: serverMessage, isTransientOverload: isTransient };
  }

  if (is503) {
    return {
      message:
        'تشهد خوادم الذكاء الاصطناعي ضغطاً مؤقتاً حالياً (503). حاول النظام إعادة المحاولة تلقائياً، يرجى المحاولة مجدداً بعد لحظات.',
      isTransientOverload: true,
    };
  }

  if (is429) {
    return {
      message:
        'خوادم الذكاء الاصطناعي مزدحمة مؤقتاً أو تم تجاوز حد الطلبات اللحظي (429). يرجى الانتظار قليلاً ثم إعادة المحاولة.',
      isTransientOverload: true,
    };
  }

  return {
    message: `تعذر الاتصال بخدمة التحليل حالياً (رمز الحالة: ${status}). يرجى المحاولة مجدداً بعد قليل.`,
    isTransientOverload: false,
  };
}

async function postGeminiEndpoint<T>(endpoint: string, payload: unknown): Promise<T> {
  // On static hosts (like GitHub Pages) or after a detected 404/405, skip doomed POST /api/*
  if (isStaticHostingEnvironment() || backendApiUnavailable) {
    throw new BackendUnavailableError();
  }

  let lastError: GeminiRequestError | null = null;

  for (let attempt = 0; attempt <= CLIENT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: ({
        error?: string;
        retriedOnServer?: boolean;
        isTransientOverload?: boolean;
      } & Partial<T>) | null = null;

      try {
        data = JSON.parse(rawText) as {
          error?: string;
          retriedOnServer?: boolean;
          isTransientOverload?: boolean;
        } & Partial<T>;
      } catch {
        data = null;
      }

      // 404 / 405 or HTML response from a static host -> backend server.ts is not running
      if (res.status === 404 || res.status === 405 || (!data && rawText.trim().startsWith('<'))) {
        backendApiUnavailable = true;
        throw new BackendUnavailableError();
      }

      // Server has no GEMINI_API_KEY configured, but user saved one locally in browser
      if (
        res.status === 500 &&
        data?.error?.includes('GEMINI_API_KEY') &&
        getStoredGeminiKey()
      ) {
        throw new BackendUnavailableError();
      }

      if (!res.ok) {
        const friendly = formatFriendlyServerError(res.status, rawText, data);
        const shouldRetry =
          (res.status === 503 || res.status === 429) &&
          !data?.retriedOnServer &&
          attempt < CLIENT_RETRY_DELAYS_MS.length;

        if (shouldRetry) {
          await sleep(CLIENT_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        throw new GeminiRequestError(
          friendly.message,
          res.status,
          friendly.isTransientOverload
        );
      }

      if (!data || typeof data !== 'object') {
        backendApiUnavailable = true;
        throw new BackendUnavailableError();
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof BackendUnavailableError) {
        throw err;
      }

      if (err instanceof GeminiRequestError) {
        lastError = err;
        break;
      }

      // Network failure reaching /api/* -> retry if transient, or fall back to browser direct if key exists
      if (attempt < CLIENT_RETRY_DELAYS_MS.length && !getStoredGeminiKey()) {
        await sleep(CLIENT_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      backendApiUnavailable = true;
      throw new BackendUnavailableError();
    }
  }

  throw (
    lastError ||
    new GeminiRequestError(
      'تشهد خوادم الذكاء الاصطناعي ضغطاً مؤقتاً حالياً. يرجى المحاولة مرة أخرى بعد قليل.',
      503,
      true
    )
  );
}

interface GeminiRestPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiRestContent {
  role?: 'user' | 'model';
  parts: GeminiRestPart[];
}

async function callGeminiRestDirect(params: {
  contents: GeminiRestContent[];
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
  modelsPriority?: string[];
}): Promise<GeneratedTextWithMeta> {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) {
    throw new GeminiRequestError(
      'التطبيق يعمل على استضافة ثابتة بدون خادم خلفي. الرجاء الضغط على «إعدادات مفتاح API» في أعلى الصفحة وإدخال مفتاح Gemini API أو OpenAI API للاستخدام المباشر.',
      401,
      true
    );
  }

  const modelsToTry = params.modelsPriority?.length ? params.modelsPriority : DIRECT_BROWSER_MODELS;
  let lastError: GeminiRequestError | null = null;

  for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
    const model = modelsToTry[modelIdx];
    const maxRetries = modelIdx === 0 ? CLIENT_RETRY_DELAYS_MS.length : 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const body: Record<string, unknown> = {
          contents: params.contents,
        };
        if (params.systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: params.systemInstruction }],
          };
        }
        if (params.generationConfig) {
          body.generationConfig = params.generationConfig;
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(body),
          }
        );

        const rawText = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          parsed = null;
        }

        if (!res.ok) {
          // If this model isn't supported on the user's API key, jump straight to next fallback model
          if (res.status === 404 && modelIdx < modelsToTry.length - 1) {
            break;
          }

          const friendly = formatFriendlyServerError(res.status, rawText, parsed as never);

          if ((res.status === 503 || res.status === 429) && attempt < maxRetries) {
            await sleep(CLIENT_RETRY_DELAYS_MS[attempt] ?? 2000);
            continue;
          }

          lastError = new GeminiRequestError(
            friendly.message,
            res.status,
            friendly.isTransientOverload
          );

          if (friendly.isTransientOverload && modelIdx < modelsToTry.length - 1) {
            break;
          }

          throw lastError;
        }

        const candidates = parsed?.candidates as
          | Array<{ content?: { parts?: Array<{ text?: string }> } }>
          | undefined;
        const outputText = (
          candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
        ).trim();

        if (!outputText) {
          throw new GeminiRequestError(
            'لم يُرجع نموذج Gemini استجابة نصية صالحة. يرجى المحاولة مجدداً.',
            502,
            false
          );
        }

        return {
          text: outputText,
          providerUsed: 'gemini',
          modelUsed: model,
        };
      } catch (err: unknown) {
        if (err instanceof GeminiRequestError) {
          lastError = err;
          if (!err.isTransientOverload) {
            throw err;
          }
          break;
        }

        if (attempt < maxRetries) {
          await sleep(CLIENT_RETRY_DELAYS_MS[attempt] ?? 2000);
          continue;
        }

        lastError = new GeminiRequestError(
          'تعذر الاتصال بخدمة Gemini مباشرة من المتصفح. يرجى التحقق من اتصال الإنترنت أو صلاحية المفتاح.',
          503,
          true
        );
      }
    }
  }

  throw (
    lastError ||
    new GeminiRequestError(
      'تشهد خوادم Gemini ضغطاً مؤقتاً حالياً. يرجى المحاولة مرة أخرى بعد لحظات.',
      503,
      true
    )
  );
}

function shouldTryOpenAiFallback(err: unknown): boolean {
  if (!getStoredOpenAiKey()) return false;
  if (err instanceof BackendUnavailableError) return true;
  return err instanceof GeminiRequestError && err.isTransientOverload;
}

const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    titleSuggestion: { type: 'STRING' },
    type: { type: 'STRING' },
    score: { type: 'INTEGER' },
    scoreBreakdown: {
      type: 'OBJECT',
      properties: {
        methodology: { type: 'INTEGER' },
        clarity: { type: 'INTEGER' },
        evidence: { type: 'INTEGER' },
        originality: { type: 'INTEGER' },
      },
      required: ['methodology', 'clarity', 'evidence', 'originality'],
    },
    keywords: { type: 'ARRAY', items: { type: 'STRING' } },
    summary: { type: 'STRING' },
    goal: { type: 'STRING' },
    methodology: {
      type: 'OBJECT',
      properties: {
        design: { type: 'STRING' },
        sample: { type: 'STRING' },
        tools: { type: 'STRING' },
        analysis: { type: 'STRING' },
        limitations: { type: 'STRING' },
      },
      required: ['design', 'sample', 'tools', 'analysis'],
    },
    findings: { type: 'ARRAY', items: { type: 'STRING' } },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          context: { type: 'STRING' },
          recommendedAnswer: { type: 'STRING' },
        },
        required: ['question', 'context', 'recommendedAnswer'],
      },
    },
    actionPlan: { type: 'ARRAY', items: { type: 'STRING' } },
    presentationPitch: { type: 'STRING' },
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

function buildAnalysisSystemInstruction(mode: AnalysisMode): string {
  const analysisTypeNames: Record<string, string> = {
    full: 'تحليل أكاديمي متكامل وشامل (بنية، منهجية، نتائج، نقد، أسئلة دفاع)',
    summary: 'ملخص تنفيذي مركّز ودقيق لأهم مخرجات البحث وأهدافه',
    critical: 'تحليل نقدي منهجي عميق (فحص العينة، الأدوات، التحيزات، التهديدات لصدق النتائج، والفجوات)',
    presentation: 'تحضير متخصص للعرض التقديمي ومناقشة لجنة التحكيم والأطروحة',
    methodology: 'تفكيك تفصيلي للإطار المنهجي والإحصائي للبحث',
  };

  const typeDesc = analysisTypeNames[mode] || analysisTypeNames.full;

  return `أنت خبير ومحكم أكاديمي مرموق متخصص في تفكيك وتحليل الأبحاث والدراسات العلمية باللغة العربية.
مهمتك: قراءة الملف أو الصورة أو النص البحثي المقدم، واستخراج بنيته العلمية بمنتهى الدقة والموضوعية الأكاديمية.
نوع التحليل المطلوب: ${typeDesc}.

قواعد التحليل:
1. استند فقط إلى ما ورد في الملف/الصورة أو ما يمكن استنباطه منطقياً منه.
2. استخدم لغة عربية أكاديمية فصيحة، واضحة ورصينة.
3. قيّم جودة البحث من 0 إلى 100 بناءً على وضوح المشكلة، تماسك المنهجية، كفاية الأدلة، وموثوقية النتائج.
4. في بنك أسئلة المناقشة: قدّم أسئلة عميقة ومتوقعة قد يطرحها محكم أكاديمي، مع تقديم إرشادات نموذجية للإجابة (الفكرة المحورية، الدليل الأكاديمي، والخلاصة).
5. يجب أن تعيد النتيجة بصيغة JSON مطابقة تماماً للمخطط المحدد.`;
}

export async function analyzeResearchWithGemini(
  text: string,
  mode: AnalysisMode,
  inlineData?: InlineFileData
): Promise<AnalysisResult> {
  const hasText = Boolean(text && text.trim().length >= 30);
  if (!hasText && !inlineData) {
    throw new Error('الرجاء رفع ملف (PDF/TXT/DOCX) أو صورة صالحة للتحليل.');
  }

  try {
    const data = await postGeminiEndpoint<{ analysis?: AnalysisResult }>('/api/gemini/analyze', {
      text,
      mode,
      inlineData: serializeInlineData(inlineData),
    });

    if (!data.analysis) {
      throw new Error('لم يُرجع الخادم نتائج تحليل صالحة.');
    }

    return normalizeAnalysisResult(data.analysis);
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        const parts: GeminiRestPart[] = [];
        if (inlineData) {
          parts.push({ inlineData: { mimeType: inlineData.mimeType, data: inlineData.data } });
        }
        parts.push({
          text: hasText
            ? `حلل البحث الأكاديمي التالي بدقة:\n\nنص البحث:\n"""\n${text.slice(0, 35000)}\n"""`
            : 'اقرأ محتوى الملف أو الصورة المرفقة بدقة واستخرج كافة النصوص والبيانات والجداول فيه، ثم حلله أكاديمياً وفق المخطط المحدد.',
        });

        const direct = await callGeminiRestDirect({
          contents: [{ role: 'user', parts }],
          systemInstruction: buildAnalysisSystemInstruction(mode),
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: ANALYSIS_RESPONSE_SCHEMA,
          },
        });
        return normalizeAnalysisResult(JSON.parse(direct.text));
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr) && text.trim().length >= 40) {
          return analyzeResearchWithOpenAI(text, mode, getStoredOpenAiKey());
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err) && text.trim().length >= 40) {
      return analyzeResearchWithOpenAI(text, mode, getStoredOpenAiKey());
    }
    throw err;
  }
}

export async function chatAboutResearchWithGemini(
  researchText: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  inlineData?: InlineFileData
): Promise<string> {
  try {
    const data = await postGeminiEndpoint<{ reply?: string }>('/api/gemini/chat', {
      researchText,
      question,
      history,
      inlineData: serializeInlineData(inlineData),
    });

    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('لم يتم استلام إجابة صالحة من الخادم.');
    }

    return data.reply;
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        const formattedHistory: GeminiRestContent[] = history.slice(-8).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const userParts: GeminiRestPart[] = [];
        if (inlineData) {
          userParts.push({ inlineData: { mimeType: inlineData.mimeType, data: inlineData.data } });
        }
        userParts.push({ text: question });

        const systemInstruction = `أنت المساعد الأكاديمي الذكي المخصص لهذا البحث.
لديك محتوى البحث أدناه، ومهمتك الإجابة عن أي سؤال يطرحه الباحث أو الطالب الأكاديمي بدقة علمية واقتباسات دقيقة متى ما أمكن باللغة العربية الفصحى.

${
  researchText
    ? `نص البحث المرجعي:\n"""\n${researchText.slice(0, 30000)}\n"""`
    : 'المرجع الأساسي هو الملف أو الصورة المرفقة في المحادثة.'
}`;

        const direct = await callGeminiRestDirect({
          contents: [...formattedHistory, { role: 'user', parts: userParts }],
          systemInstruction,
        });
        return direct.text;
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr) && researchText.trim().length > 0) {
          return chatAboutResearchWithOpenAI(
            researchText,
            question,
            history,
            getStoredOpenAiKey()
          );
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err) && researchText.trim().length > 0) {
      return chatAboutResearchWithOpenAI(
        researchText,
        question,
        history,
        getStoredOpenAiKey()
      );
    }
    throw err;
  }
}

export async function detectAiContentWithGemini(
  text: string,
  inlineData?: InlineFileData
): Promise<AiDetectionResult> {
  const hasText = Boolean(text && text.trim().length >= 30);
  if (!hasText && !inlineData) {
    throw new Error('الرجاء رفع ملف أو صورة صالحة لفحص نسبة الذكاء الاصطناعي.');
  }

  try {
    const data = await postGeminiEndpoint<{ detection?: AiDetectionResult }>(
      '/api/gemini/detect-ai',
      {
        text,
        inlineData: serializeInlineData(inlineData),
      }
    );

    if (!data.detection) {
      throw new Error('لم يُرجع الخادم نتيجة فحص صالحة.');
    }

    return data.detection;
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        const parts: GeminiRestPart[] = [];
        if (inlineData) {
          parts.push({ inlineData: { mimeType: inlineData.mimeType, data: inlineData.data } });
        }
        parts.push({ text: buildAiDetectionUserPrompt(text) });

        const direct = await callGeminiRestDirect({
          contents: [{ role: 'user', parts }],
          systemInstruction: AI_DETECTION_SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                ai_percentage: { type: 'INTEGER' },
                human_percentage: { type: 'INTEGER' },
                confidence: { type: 'INTEGER' },
                repetitive_patterns: { type: 'INTEGER' },
                vocabulary_diversity: { type: 'INTEGER' },
                human_errors: { type: 'INTEGER' },
                personal_depth: { type: 'INTEGER' },
                manipulation_attempt: { type: 'BOOLEAN' },
                verdict: {
                  type: 'STRING',
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
        return normalizeAiDetectionResult(direct.text);
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr) && text.trim().length >= 40) {
          return detectAiContentWithOpenAI(text, getStoredOpenAiKey());
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err) && text.trim().length >= 40) {
      return detectAiContentWithOpenAI(text, getStoredOpenAiKey());
    }
    throw err;
  }
}

export async function generateResearchOutlineWithGemini(
  title: string
): Promise<GeneratedTextWithMeta> {
  const systemInstruction = `You are an expert academic research planner. Based on the user's research title, generate a clear, logical, and editable research outline (main sections and 2-3 bullet points under each). 
Keep the points concise and analytical—do not write full paragraphs yet. At the end of each section, add a brief placeholder prompt like "[Add your personal insight, local example, or specific data here]" to encourage the researcher to inject their own perspective before full drafting. Output in the exact same language as the user's title.`;

  try {
    const data = await postGeminiEndpoint<{
      outline?: string;
      providerUsed?: 'gemini' | 'openai';
      modelUsed?: string;
    }>('/api/gemini/outline', {
      title,
    });

    if (typeof data.outline !== 'string' || !data.outline.trim()) {
      throw new Error('لم يتم استلام المخطط البحثي من الخادم. يرجى إعادة المحاولة.');
    }

    return {
      text: data.outline,
      providerUsed: data.providerUsed || 'gemini',
      modelUsed: data.modelUsed || 'gemini-4-hydrogen',
    };
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        return await callGeminiRestDirect({
          contents: [{ role: 'user', parts: [{ text: `Research Title:\n"${title.slice(0, 1000)}"` }] }],
          systemInstruction,
        });
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr)) {
          const text = await generateTextWithOpenAIFallback({
            apiKey: getStoredOpenAiKey(),
            systemInstruction,
            userPrompt: `Research Title:\n"${title}"`,
          });
          return { text, providerUsed: 'openai', modelUsed: 'gpt-4o' };
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err)) {
      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction,
        userPrompt: `Research Title:\n"${title}"`,
      });
      return {
        text,
        providerUsed: 'openai',
        modelUsed: 'gpt-4o',
      };
    }
    throw err;
  }
}

export async function draftHumanizedPaperWithGemini(params: {
  title?: string;
  outline: string;
  personalNotes?: string;
}): Promise<GeneratedTextWithMeta> {
  const systemInstruction = `You are a senior academic researcher and editor writing a final research paper based strictly on the user's modified outline and personal notes. 

To ensure the writing reads naturally like an authentic human-authored paper and avoids robotic AI patterns, strictly follow these rules:
1. Anchor around user inputs: Prioritize and weave the user's custom notes, examples, and modified structure into the core of each paragraph.
2. High Burstiness (Sentence Variety): Mix short, direct, declarative sentences (6-10 words) with longer, complex analytical sentences (20-30 words). Never write three sentences of similar length in a row.
3. Zero AI Clichés: Strictly avoid overused transitional filler and buzzwords (such as: "In conclusion", "Furthermore", "Moreover", "It is crucial to note", "delve into", "tapestry", "testament", "navigating the landscape", "in today's fast-paced world", or their direct Arabic equivalents like "علاوة على ذلك", "في ختام المطاف", "تجدر الإشارة إلى", "مما لا شك فيه").
4. Asymmetric Flow: Vary how paragraphs begin. Start some with a direct claim, others with evidence or context, and avoid symmetrical bulleted lists unless strictly necessary for data.
5. Academic Rigor without Fluff: Maintain formal, objective academic tone, ensuring logical transitions through meaning rather than mechanical linking words.

Write the complete text in the same language as the outline provided.`;

  const promptParts = [
    params.title ? `Research Title:\n${params.title.slice(0, 1000)}` : '',
    `Modified Research Outline:\n"""\n${params.outline.slice(0, 25000)}\n"""`,
    params.personalNotes
      ? `Researcher's Additional Personal Notes, Local Examples, and Data:\n"""\n${params.personalNotes.slice(0, 12000)}\n"""`
      : '',
  ].filter(Boolean);

  try {
    const data = await postGeminiEndpoint<{
      paper?: string;
      providerUsed?: 'gemini' | 'openai';
      modelUsed?: string;
    }>('/api/gemini/draft-paper', params);

    if (typeof data.paper !== 'string' || !data.paper.trim()) {
      throw new Error('لم يتم استلام مسودة البحث من الخادم. يرجى إعادة المحاولة.');
    }

    return {
      text: data.paper,
      providerUsed: data.providerUsed || 'gemini',
      modelUsed: data.modelUsed || 'gemini-4-hydrogen',
    };
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        return await callGeminiRestDirect({
          contents: [{ role: 'user', parts: [{ text: promptParts.join('\n\n') }] }],
          systemInstruction,
        });
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr)) {
          const text = await generateTextWithOpenAIFallback({
            apiKey: getStoredOpenAiKey(),
            systemInstruction,
            userPrompt: promptParts.join('\n\n'),
          });
          return { text, providerUsed: 'openai', modelUsed: 'gpt-4o' };
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err)) {
      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction,
        userPrompt: promptParts.join('\n\n'),
      });
      return {
        text,
        providerUsed: 'openai',
        modelUsed: 'gpt-4o',
      };
    }
    throw err;
  }
}

export async function generateStrategicAuditChapterWithGemini(params: {
  companyName: string;
  targetChapter: string;
  chapterInstructions?: string;
  companyDataAndRubric?: string;
  researcherNotes?: string;
  previousChaptersContext?: string;
  language?: 'auto' | 'en' | 'ar';
}): Promise<GeneratedTextWithMeta> {
  const compactPrevContext = params.previousChaptersContext
    ? params.previousChaptersContext.trim().split(/\s+/).slice(0, 1250).join(' ')
    : undefined;

  const payload = {
    ...params,
    previousChaptersContext: compactPrevContext,
  };

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
    params.language === 'ar'
      ? 'Output Language: Write the entire chapter, headings, tables, and academic prose in formal Academic Arabic (with standard English matrix acronyms/terms such as EFE, IFE, SWOT, SPACE, QSPM alongside Arabic where appropriate).'
      : params.language === 'en'
        ? 'Output Language: Write the entire chapter, headings, tables, and academic prose in formal Academic English.'
        : 'Output Language: Match the primary language of the target chapter title, company data, and researcher notes.';

  const userParts = [
    `Target Company / Organization:\n${params.companyName.slice(0, 500)}`,
    `Target Chapter to Write NOW (Write ONLY this chapter in exhaustive 2,000–2,500 word depth):\n${params.targetChapter.slice(0, 1000)}`,
    languageDirective,
    params.chapterInstructions
      ? `Chapter Specific Scope & Required Analytical Deliverables:\n${params.chapterInstructions.slice(0, 3000)}`
      : '',
    params.companyDataAndRubric
      ? `Company Financial/Market Data & Assignment Guidelines / Rubric:\n"""\n${params.companyDataAndRubric.slice(0, 20000)}\n"""`
      : '',
    compactPrevContext
      ? `Previous Chapters Key Metrics & Matrices Digest (MUST stay strictly consistent with these figures):\n"""\n${compactPrevContext}\n"""`
      : '',
    params.researcherNotes
      ? `Researcher's Specific Notes, Local Examples, & Explicit Assumptions (Anchor your analysis around these):\n"""\n${params.researcherNotes.slice(0, 12000)}\n"""`
      : '',
  ].filter(Boolean);

  try {
    const data = await postGeminiEndpoint<{
      chapter?: string;
      providerUsed?: 'gemini' | 'openai';
      modelUsed?: string;
    }>('/api/gemini/strategic-audit-chapter', payload);

    if (typeof data.chapter !== 'string' || !data.chapter.trim()) {
      throw new Error('لم يتم استلام نص الفصل من الخادم. يرجى إعادة المحاولة.');
    }

    return {
      text: data.chapter,
      providerUsed: data.providerUsed || 'gemini',
      modelUsed: data.modelUsed || 'gemini-2.5-flash',
    };
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      try {
        return await callGeminiRestDirect({
          contents: [{ role: 'user', parts: [{ text: userParts.join('\n\n') }] }],
          systemInstruction,
          generationConfig: { maxOutputTokens: 16384 },
        });
      } catch (directErr: unknown) {
        if (shouldTryOpenAiFallback(directErr)) {
          const text = await generateTextWithOpenAIFallback({
            apiKey: getStoredOpenAiKey(),
            systemInstruction,
            userPrompt: userParts.join('\n\n'),
          });
          return { text, providerUsed: 'openai', modelUsed: 'gpt-4o' };
        }
        throw directErr;
      }
    }

    if (shouldTryOpenAiFallback(err)) {
      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction,
        userPrompt: userParts.join('\n\n'),
      });
      return {
        text,
        providerUsed: 'openai',
        modelUsed: 'gpt-4o',
      };
    }
    throw err;
  }
}
