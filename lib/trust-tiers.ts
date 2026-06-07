import type { TrustTier, FreshnessTrend } from '@/types';

export function computeTier(proofCount: number, trend: FreshnessTrend): TrustTier {
  // Demote first — weakening/stale drops one tier from where proofCount would put you
  if (trend === 'weakening' || trend === 'stale') {
    if (proofCount >= 5) return 'warn';  // would-be block, demoted
    return 'suggest';                    // would-be warn, demoted
  }
  if (proofCount >= 5 && (trend === 'stable' || trend === 'strengthening')) return 'block';
  if (proofCount >= 3 && trend === 'strengthening') return 'warn';
  return 'suggest';
}

export const TIER_CONFIG = {
  suggest: {
    label: 'Suggest',
    color: 'text-sky-400',
    bg: 'bg-sky-950/40',
    border: 'border-sky-800/60',
    dot: 'bg-sky-400',
    description: '1–2 observations',
  },
  warn: {
    label: 'Warn',
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-800/60',
    dot: 'bg-amber-400',
    description: '3–4, strengthening',
  },
  block: {
    label: 'Block',
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-800/60',
    dot: 'bg-rose-400',
    description: '5+, stable',
  },
} as const;

export const TREND_CONFIG = {
  strengthening: { symbol: '↑', color: 'text-emerald-400', label: 'Strengthening' },
  stable:        { symbol: '→', color: 'text-zinc-400',    label: 'Stable'        },
  weakening:     { symbol: '↓', color: 'text-amber-400',   label: 'Weakening'     },
  stale:         { symbol: '—', color: 'text-zinc-600',    label: 'Stale'         },
} as const;
