import type { FreshnessTrend } from '@/types';
import { TREND_CONFIG } from '@/lib/trust-tiers';

interface TrendIconProps {
  trend: FreshnessTrend;
  showLabel?: boolean;
}

export default function TrendIcon({ trend, showLabel = false }: TrendIconProps) {
  const cfg = TREND_CONFIG[trend];
  return (
    <span className={`font-mono text-sm leading-none ${cfg.color}`} title={cfg.label}>
      {cfg.symbol}
      {showLabel && (
        <span className="ml-1 text-xs font-sans">{cfg.label}</span>
      )}
    </span>
  );
}
