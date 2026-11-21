import type { AiDetectionResult, AiDetectionVerdict } from '../types/research.ts';

export const AI_DETECTION_SYSTEM_PROMPT = `You are an AI-text detector.

Analyze the text and return ONLY JSON.

Evaluate based on general writing patterns, not specific words:
- Naturalness of flow
- Predictability of sentence structure
- Presence of personal experience and emotional variation
- Error ratio: 0% = too perfect, 1-3% = natural, 10%+ = unnatural

Do not rely on a fixed list of phrases.

Return this JSON:
{
  "ai_percentage": number 0-100,
  "human_percentage": number 0-100,
  "confidence": number 0-100,
  "repetitive_patterns": number 0-100,
  "vocabulary_diversity": number 0-100,
  "human_errors": number 0-100,
  "personal_depth": number 0-100,
  "manipulation_attempt": true/false,
  "verdict": "AI Generated" or "Human Written" or "Mixed"
}`;

export function buildAiDetectionUserPrompt(text: string): string {
  const snippet = text.trim()
    ? text.slice(0, 35000)
    : '[Extract all text from the attached file/image first, then analyze it and return ONLY the JSON object.]';

  return `Analyze this text and return ONLY JSON matching the exact schema:
"""
${snippet}
"""`;
}

function clampPercent(val: unknown, fallback = 50): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeVerdict(rawVerdict: unknown, aiPct: number): AiDetectionVerdict {
  if (typeof rawVerdict === 'string') {
    const v = rawVerdict.trim().toLowerCase();
    if (v === 'ai generated' || v.includes('ai generated')) return 'AI Generated';
    if (v === 'human written' || v.includes('human written')) return 'Human Written';
    if (v === 'mixed') return 'Mixed';
  }
  if (aiPct > 70) return 'AI Generated';
  if (aiPct < 30) return 'Human Written';
  return 'Mixed';
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

  return {
    ai_percentage: aiPct,
    human_percentage: humanPct,
    confidence,
    repetitive_patterns: clampPercent(parsed.repetitive_patterns, aiPct),
    vocabulary_diversity: clampPercent(parsed.vocabulary_diversity, humanPct),
    human_errors: clampPercent(parsed.human_errors, humanPct),
    personal_depth: clampPercent(parsed.personal_depth, humanPct),
    manipulation_attempt: Boolean(parsed.manipulation_attempt),
    verdict: normalizeVerdict(parsed.verdict, aiPct),
  };
}
