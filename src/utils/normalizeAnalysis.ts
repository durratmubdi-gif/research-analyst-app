import type { AnalysisResult, DefenseQuestion } from '../types/research.ts';

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
}

function toNumber(val: unknown, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toQuestionsArray(val: unknown): DefenseQuestion[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      question: typeof item.question === 'string' ? item.question.trim() : '',
      context: typeof item.context === 'string' ? item.context.trim() : '',
      recommendedAnswer:
        typeof item.recommendedAnswer === 'string' ? item.recommendedAnswer.trim() : '',
    }))
    .filter((q) => q.question.length > 0 || q.recommendedAnswer.length > 0);
}

export function normalizeAnalysisResult(raw: unknown): AnalysisResult {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const score = toNumber(data.score, 75);
  const sb = (
    data.scoreBreakdown && typeof data.scoreBreakdown === 'object' ? data.scoreBreakdown : {}
  ) as Record<string, unknown>;
  const meth = (
    data.methodology && typeof data.methodology === 'object' ? data.methodology : {}
  ) as Record<string, unknown>;

  return {
    titleSuggestion:
      typeof data.titleSuggestion === 'string' && data.titleSuggestion.trim()
        ? data.titleSuggestion.trim()
        : 'تحليل البحث الأكاديمي',
    type:
      typeof data.type === 'string' && data.type.trim()
        ? data.type.trim()
        : 'بحث أكاديمي تحليلي',
    score,
    scoreBreakdown: {
      methodology: toNumber(sb.methodology, score),
      clarity: toNumber(sb.clarity, score),
      evidence: toNumber(sb.evidence, score),
      originality: toNumber(sb.originality, score),
    },
    keywords: toStringArray(data.keywords),
    summary: typeof data.summary === 'string' ? data.summary.trim() : '',
    goal: typeof data.goal === 'string' ? data.goal.trim() : '',
    methodology: {
      design: typeof meth.design === 'string' ? meth.design.trim() : '',
      sample: typeof meth.sample === 'string' ? meth.sample.trim() : '',
      tools: typeof meth.tools === 'string' ? meth.tools.trim() : '',
      analysis: typeof meth.analysis === 'string' ? meth.analysis.trim() : '',
      limitations:
        typeof meth.limitations === 'string' && meth.limitations.trim()
          ? meth.limitations.trim()
          : undefined,
    },
    findings: toStringArray(data.findings),
    strengths: toStringArray(data.strengths),
    weaknesses: toStringArray(data.weaknesses),
    questions: toQuestionsArray(data.questions),
    actionPlan: toStringArray(data.actionPlan),
    presentationPitch:
      typeof data.presentationPitch === 'string' && data.presentationPitch.trim()
        ? data.presentationPitch.trim()
        : undefined,
  };
}
