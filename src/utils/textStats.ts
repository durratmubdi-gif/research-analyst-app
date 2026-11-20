export interface TextMetrics {
  words: number;
  chars: number;
  sentences: number;
  readingTimeMinutes: number;
  topKeywords: string[];
}

const ARABIC_STOP_WORDS = new Set([
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين',
  'اللواتي', 'هو', 'هي', 'هم', 'هن', 'أن', 'إن', 'كان', 'كانت', 'يكون', 'تكون', 'ما', 'لا',
  'لم', 'لن', 'قد', 'ثم', 'أو', 'أم', 'بل', 'لكن', 'بين', 'عند', 'بعد', 'قبل', 'حيث',
  'كل', 'جميع', 'بعض', 'غير', 'سوى', 'أكثر', 'أقل', 'تم', 'تمت', 'كما', 'كذلك', 'أيضا',
  'أيضاً', 'هناك', 'خلال', 'نحو', 'حول', 'ضد', 'حتى', 'إذا', 'لو', 'لولا', 'فإن', 'ولكن'
]);

export function calculateTextMetrics(text: string): TextMetrics {
  const clean = text.trim();
  if (!clean) {
    return { words: 0, chars: 0, sentences: 0, readingTimeMinutes: 0, topKeywords: [] };
  }

  const wordsArray = clean.split(/\s+/).filter(Boolean);
  const words = wordsArray.length;
  const chars = clean.length;

  // Sentences split on Arabic/English sentence endings
  const sentences = clean
    .split(/(?<=[.!?؛؟\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5).length || 1;

  // Average reading speed for academic text ~ 180 words/min
  const readingTimeMinutes = Math.max(1, Math.round(words / 180));

  // Keyword frequency calculation
  const freqMap: Record<string, number> = {};
  const cleanedTokens = clean
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 4 && !ARABIC_STOP_WORDS.has(w));

  cleanedTokens.forEach((word) => {
    freqMap[word] = (freqMap[word] || 0) + 1;
  });

  const topKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  return {
    words,
    chars,
    sentences,
    readingTimeMinutes,
    topKeywords,
  };
}
