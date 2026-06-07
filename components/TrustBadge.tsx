import type { TrustTier } from '@/types';
import { TIER_CONFIG } from '@/lib/trust-tiers';

interface TrustBadgeProps {
  tier: TrustTier;
  size?: 'sm' | 'md';
}

export default function TrustBadge({ tier, size = 'md' }: TrustBadgeProps) {
  const cfg = TIER_CONFIG[tier];
  const cls = size === 'sm'
    ? 'text-[10px] px-1.5 py-px'
    : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-bold tracking-wide border ${cls} ${cfg.color} ${cfg.bg} ${cfg.border}`}
      title={cfg.description}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label.toUpperCase()}
    </span>
  );
}
