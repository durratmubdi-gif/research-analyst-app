import { SavedResearch, AnalysisResult } from '../types/research';

const STORAGE_KEY = 'academic_research_saved_v2';

export function getSavedResearches(): SavedResearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy key if any
      const legacy = localStorage.getItem('saved_researches');
      if (legacy) {
        try {
          const list = JSON.parse(legacy);
          return Array.isArray(list) ? list : [];
        } catch {
          return [];
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading saved researches from localStorage', err);
    return [];
  }
}

export function saveResearch(
  title: string,
  rawText: string,
  analysis: AnalysisResult,
  wordCount: number,
  readingTime: number
): SavedResearch {
  const list = getSavedResearches();
  const newItem: SavedResearch = {
    id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: title.trim() || analysis.titleSuggestion || 'بحث بدون عنوان',
    date: new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    timestamp: Date.now(),
    rawText,
    analysis,
    wordCount,
    readingTime,
    type: analysis.type,
    score: analysis.score,
  };

  const updated = [newItem, ...list];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newItem;
}

export function deleteSavedResearch(id: string): SavedResearch[] {
  const list = getSavedResearches();
  const updated = list.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAllSavedResearches(): void {
  localStorage.removeItem(STORAGE_KEY);
}
