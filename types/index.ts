export type FeedbackState = 'idle' | 'pending' | 'accepted' | 'rejected';

export type TrustTier = 'suggest' | 'warn' | 'block';

export type FreshnessTrend = 'strengthening' | 'stable' | 'weakening' | 'stale';

export interface Convention {
  id: string;
  text: string;
  tier: TrustTier;
  proofCount: number;
  trend: FreshnessTrend;
  category: string;
}

export interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'header';
  lineNo: number | null;
  oldLineNo: number | null;
  content: string;
}

export interface ReviewComment {
  id: string;
  lineNo: number;
  text: string;
  conventionId: string;
  tier: TrustTier;
  rationale: string;
}

export interface Observation {
  id: string;
  text: string;
  type: 'world' | 'experience' | 'observation';
  proofCount?: number;
  trend?: FreshnessTrend;
}

export interface LiveStats {
  reviews: number;
  issues: { total: number; block: number; warn: number; suggest: number };
  feedback: { accepted: number; rejected: number };
}

export interface TeamMemory {
  conventions: Convention[];
  observations: Observation[];
  styleGuide: string[];
  lastUpdated: string;
}

export interface ReviewSession {
  id: string;
  filePath: string;
  diff: DiffLine[];
  comments: ReviewComment[];
}
