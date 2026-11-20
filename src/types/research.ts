export interface ScoreBreakdown {
  methodology: number;
  clarity: number;
  evidence: number;
  originality: number;
}

export interface MethodologyBreakdown {
  design: string;
  sample: string;
  tools: string;
  analysis: string;
  limitations?: string;
}

export interface DefenseQuestion {
  question: string;
  context: string;
  recommendedAnswer: string;
}

export interface AnalysisResult {
  titleSuggestion: string;
  type: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  keywords: string[];
  summary: string;
  goal: string;
  methodology: MethodologyBreakdown;
  findings: string[];
  strengths: string[];
  weaknesses: string[];
  questions: DefenseQuestion[];
  actionPlan: string[];
  presentationPitch?: string;
}

export interface SavedResearch {
  id: string;
  title: string;
  date: string;
  timestamp: number;
  rawText: string;
  analysis: AnalysisResult;
  wordCount: number;
  readingTime: number;
  type: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export type AnalysisMode = 'full' | 'summary' | 'critical' | 'presentation' | 'methodology';
