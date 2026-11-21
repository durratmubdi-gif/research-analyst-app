import { AnalysisMode, AnalysisResult, AiDetectionResult } from '../types/research';
import { InlineFileData } from '../utils/pdfExtractor';
import { normalizeAnalysisResult } from '../utils/normalizeAnalysis';

function serializeInlineData(inlineData?: InlineFileData) {
  if (!inlineData) return undefined;
  return {
    mimeType: inlineData.mimeType,
    data: inlineData.data,
  };
}

async function postGeminiEndpoint<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `تعذر الاتصال بالخادم (رمز الخطأ: ${res.status})`);
  }

  return data;
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

  const data = await postGeminiEndpoint<{ analysis: AnalysisResult }>('/api/gemini/analyze', {
    text,
    mode,
    inlineData: serializeInlineData(inlineData),
  });

  return normalizeAnalysisResult(data.analysis);
}

export async function chatAboutResearchWithGemini(
  researchText: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  inlineData?: InlineFileData
): Promise<string> {
  const data = await postGeminiEndpoint<{ reply: string }>('/api/gemini/chat', {
    researchText,
    question,
    history,
    inlineData: serializeInlineData(inlineData),
  });

  return data.reply;
}

export async function detectAiContentWithGemini(
  text: string,
  inlineData?: InlineFileData
): Promise<AiDetectionResult> {
  const hasText = Boolean(text && text.trim().length >= 30);
  if (!hasText && !inlineData) {
    throw new Error('الرجاء رفع ملف أو صورة صالحة لفحص نسبة الذكاء الاصطناعي.');
  }

  const data = await postGeminiEndpoint<{ detection: AiDetectionResult }>('/api/gemini/detect-ai', {
    text,
    inlineData: serializeInlineData(inlineData),
  });

  return data.detection;
}
