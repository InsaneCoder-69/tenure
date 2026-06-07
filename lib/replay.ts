import type { FreshnessTrend, TrustTier } from '@/types';

// ── types ────────────────────────────────────────────────────────────────────

export type ReplayPhase =
  | 'idle'       // waiting to start — "Run Demo" is shown
  | 'scanning'   // "Scanning diff for violations…"
  | 'reviewing'  // comments appearing one by one
  | 'promoting'  // tier promotion hero moment
  | 'learning'   // memory self-writes hero moment
  | 'complete';  // done

export interface HeroMoment {
  id: 'first-block' | 'tier-promoted' | 'memory-learned';
  title: string;
  body: string;
}

export interface ConventionPatch {
  proofCount?: number;
  trend?: FreshnessTrend;
  tier?: TrustTier;
}

export interface ReplayStep {
  id: string;
  phase: ReplayPhase;
  /** Milliseconds before auto-advancing. 0 = stay until user acts. */
  autoAdvanceMs: number;
  visibleCommentIds: string[];
  highlightConventionId: string | null;
  heroMoment: HeroMoment | null;
  /** Convention fields to override at this step (rest stay as-is). */
  conventionPatches: Record<string, ConventionPatch>;
  /** If set, appended to styleGuide array at this step. */
  styleGuideAppend: string | null;
}

// ── step script ───────────────────────────────────────────────────────────────
//
// Three hero moments:
//   Step 2 — first BLOCK fires, grounded in a real outage
//   Step 7 — hook-naming earns promotion from WARN → BLOCK
//   Step 8 — Tenure rewrites the style guide unprompted

export const REPLAY_STEPS: ReplayStep[] = [
  // ── 0: idle ────────────────────────────────────────────────────────────────
  {
    id: 'idle',
    phase: 'idle',
    autoAdvanceMs: 0,
    visibleCommentIds: [],
    highlightConventionId: null,
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 1: scanning ────────────────────────────────────────────────────────────
  {
    id: 'scanning',
    phase: 'scanning',
    autoAdvanceMs: 1800,
    visibleCommentIds: [],
    highlightConventionId: null,
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 2: HERO 1 — first BLOCK drops ─────────────────────────────────────────
  {
    id: 'comment-async-error-handling',
    phase: 'reviewing',
    autoAdvanceMs: 3500,
    visibleCommentIds: ['cmt-1'],
    highlightConventionId: 'async-error-handling',
    heroMoment: {
      id: 'first-block',
      title: 'BLOCK enforced',
      body: 'Grounded in a real Q3 2024 outage — Tenure learned this rule from production pain, not documentation.',
    },
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 3: second BLOCK ────────────────────────────────────────────────────────
  {
    id: 'comment-no-any-1',
    phase: 'reviewing',
    autoAdvanceMs: 2000,
    visibleCommentIds: ['cmt-1', 'cmt-2'],
    highlightConventionId: 'no-any',
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 4: WARN — hook naming ──────────────────────────────────────────────────
  {
    id: 'comment-hook-naming',
    phase: 'reviewing',
    autoAdvanceMs: 2000,
    visibleCommentIds: ['cmt-1', 'cmt-2', 'cmt-3'],
    highlightConventionId: 'hook-naming',
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 5: BLOCK again (no-any, second instance) ───────────────────────────────
  {
    id: 'comment-no-any-2',
    phase: 'reviewing',
    autoAdvanceMs: 1800,
    visibleCommentIds: ['cmt-1', 'cmt-2', 'cmt-3', 'cmt-4'],
    highlightConventionId: 'no-any',
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 6: WARN — no-console ──────────────────────────────────────────────────
  {
    id: 'comment-no-console',
    phase: 'reviewing',
    autoAdvanceMs: 2200,
    visibleCommentIds: ['cmt-1', 'cmt-2', 'cmt-3', 'cmt-4', 'cmt-5'],
    highlightConventionId: 'no-console',
    heroMoment: null,
    conventionPatches: {},
    styleGuideAppend: null,
  },

  // ── 7: HERO 2 — tier promotion ─────────────────────────────────────────────
  {
    id: 'tier-promotion',
    phase: 'promoting',
    autoAdvanceMs: 4000,
    visibleCommentIds: ['cmt-1', 'cmt-2', 'cmt-3', 'cmt-4', 'cmt-5'],
    highlightConventionId: 'hook-naming',
    heroMoment: {
      id: 'tier-promoted',
      title: 'hook-naming promoted to BLOCK',
      body: '5 consecutive violations across 5 PRs. Tenure upgraded the tier automatically — no config change needed.',
    },
    conventionPatches: {
      'hook-naming': { proofCount: 5, trend: 'strengthening', tier: 'block' },
    },
    styleGuideAppend: null,
  },

  // ── 8: HERO 3 — memory self-writes ────────────────────────────────────────
  {
    id: 'memory-learned',
    phase: 'learning',
    autoAdvanceMs: 0,
    visibleCommentIds: ['cmt-1', 'cmt-2', 'cmt-3', 'cmt-4', 'cmt-5'],
    highlightConventionId: null,
    heroMoment: {
      id: 'memory-learned',
      title: 'Tenure rewrote the style guide',
      body: "Based on this session, Tenure added a new rule. It learned it — you didn't write it.",
    },
    conventionPatches: {
      'hook-naming': { proofCount: 5, trend: 'strengthening', tier: 'block' },
    },
    styleGuideAppend:
      'Custom hooks must use the `use` prefix — name the hook after the concept it encapsulates, not its implementation',
  },
];

export const PHASE_LABEL: Record<ReplayPhase, string> = {
  idle:      'Ready',
  scanning:  'Scanning diff…',
  reviewing: 'Reviewing…',
  promoting: 'Tier promoted',
  learning:  'Memory updated',
  complete:  'Complete',
};
