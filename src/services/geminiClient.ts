import { AnalysisMode, AnalysisResult, AiDetectionResult } from '../types/research';
import { InlineFileData } from '../utils/pdfExtractor';
import { normalizeAnalysisResult } from '../utils/normalizeAnalysis';
import {
  analyzeResearchWithOpenAI,
  chatAboutResearchWithOpenAI,
  detectAiContentWithOpenAI,
  generateTextWithOpenAIFallback,
  getStoredOpenAiKey,
} from './openaiClient';

const CLIENT_RETRY_DELAYS_MS = [2000, 4000, 8000];

export interface ExecutionMetadata {
  providerUsed: 'gemini' | 'openai';
  modelUsed: string;
}

export interface GeneratedTextWithMeta extends ExecutionMetadata {
  text: string;
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
  parsed: { error?: string; isTransientOverload?: boolean } | null
): { message: string; isTransientOverload: boolean } {
  const serverMessage = typeof parsed?.error === 'string' ? parsed.error.trim() : '';
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

  const isTransient = Boolean(parsed?.isTransientOverload) || is503 || is429;

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
    message: `تعذر الاتصال بالخادم حالياً (رمز الحالة: ${status}). يرجى المحاولة مجدداً بعد قليل.`,
    isTransientOverload: false,
  };
}

async function postGeminiEndpoint<T>(endpoint: string, payload: unknown): Promise<T> {
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
        throw new GeminiRequestError(
          'استجابة غير متوقعة من الخادم. يرجى إعادة المحاولة.',
          502,
          false
        );
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof GeminiRequestError) {
        lastError = err;
        break;
      }

      // Network / temporary connection interruption
      if (attempt < CLIENT_RETRY_DELAYS_MS.length) {
        await sleep(CLIENT_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      lastError = new GeminiRequestError(
        'تعذر الوصول إلى خادم التحليل مؤقتاً. يرجى التحقق من الاتصال والمحاولة مجدداً.',
        503,
        true
      );
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

function shouldTryOpenAiFallback(err: unknown): boolean {
  return err instanceof GeminiRequestError && err.isTransientOverload && Boolean(getStoredOpenAiKey());
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
    if (shouldTryOpenAiFallback(err) && text.trim().length >= 40) {
      return detectAiContentWithOpenAI(text, getStoredOpenAiKey());
    }
    throw err;
  }
}

export async function generateResearchOutlineWithGemini(
  title: string
): Promise<GeneratedTextWithMeta> {
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
    if (shouldTryOpenAiFallback(err)) {
      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction:
          'You are an expert academic research planner. Based on the user research title, generate a clear, logical, editable research outline (main sections and 2-3 bullet points under each) with brief placeholders like "[Add your personal insight, local example, or specific data here]". Output in the exact same language as the title.',
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
    if (shouldTryOpenAiFallback(err)) {
      const promptParts = [
        params.title ? `Research Title:\n${params.title}` : '',
        `Modified Research Outline:\n"""\n${params.outline}\n"""`,
        params.personalNotes
          ? `Researcher Notes & Local Examples:\n"""\n${params.personalNotes}\n"""`
          : '',
      ].filter(Boolean);

      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction:
          'You are a senior academic researcher writing a natural human-authored paper strictly based on the user outline and personal notes. Mix short direct sentences with longer analytical ones, avoid AI clichés, and write in the same language as the outline.',
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
    if (shouldTryOpenAiFallback(err)) {
      const userParts = [
        `Target Company: ${params.companyName}`,
        `Target Chapter: ${params.targetChapter}`,
        params.chapterInstructions ? `Chapter Scope: ${params.chapterInstructions}` : '',
        params.companyDataAndRubric ? `Company Data & Rubric:\n${params.companyDataAndRubric}` : '',
        compactPrevContext ? `Previous Chapters Context:\n${compactPrevContext}` : '',
        params.researcherNotes ? `Researcher Notes:\n${params.researcherNotes}` : '',
      ].filter(Boolean);

      const text = await generateTextWithOpenAIFallback({
        apiKey: getStoredOpenAiKey(),
        systemInstruction:
          'You are a senior Strategic Management Professor writing ONE comprehensive chapter (~2,000-2,500 words) of a 45-page Strategic Audit Report with numbered Markdown tables, strict financial/matrix consistency, varied human-like academic prose, and APA citations + References.',
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
