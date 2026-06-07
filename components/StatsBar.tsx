'use client';

import type { LiveStats, TeamMemory, TrustTier } from '@/types';

function computeHealth(conventions: TeamMemory['conventions'], stats: LiveStats): number {
  const block   = conventions.filter((c) => c.tier === 'block').length;
  const warn    = conventions.filter((c) => c.tier === 'warn').length;
  const suggest = conventions.filter((c) => c.tier === 'suggest').length;
  const total   = conventions.length;

  const rawScore  = block * 3 + warn * 2 + suggest * 1;
  const convScore = total > 0 ? rawScore / (total * 3) : 0;

  const totalFeedback = stats.feedback.accepted + stats.feedback.rejected;
  const acceptRate    = totalFeedback > 0 ? stats.feedback.accepted / totalFeedback : 1;

  return Math.round(Math.min(convScore * 100, 100) * (0.4 + acceptRate * 0.6));
}

function Divider() {
  return <span className="shrink-0 w-px h-6 bg-zinc-800 mx-3" />;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5 shrink-0">
      <span className="text-zinc-100 font-semibold tabular-nums">{value}</span>
      <span className="text-zinc-600 text-[11px] font-mono">{label}</span>
    </span>
  );
}

function TierChip({ count, tier }: { count: number; tier: TrustTier }) {
  const color =
    tier === 'block' ? 'text-rose-400' :
    tier === 'warn'  ? 'text-amber-400' :
                       'text-sky-400';
  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {count} {tier}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-emerald-500' :
    score >= 40 ? 'bg-amber-500'   :
                  'bg-rose-500';
  return (
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-zinc-500 text-[11px] font-mono">Health</span>
      <span className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
        <span
          className={`block h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className="text-zinc-100 font-semibold tabular-nums text-sm w-7 text-right">
        {score}
      </span>
    </span>
  );
}

interface StatsBarProps {
  stats: LiveStats | null;
  memory: TeamMemory | null;
}

export default function StatsBar({ stats, memory }: StatsBarProps) {
  if (!stats) return null;

  const conventions = memory?.conventions ?? [];
  const blockConv   = conventions.filter((c) => c.tier === 'block').length;
  const warnConv    = conventions.filter((c) => c.tier === 'warn').length;
  const suggestConv = conventions.filter((c) => c.tier === 'suggest').length;

  const totalFeedback  = stats.feedback.accepted + stats.feedback.rejected;
  const acceptancePct  = totalFeedback > 0
    ? Math.round(stats.feedback.accepted / totalFeedback * 100)
    : null;

  const health = computeHealth(conventions, stats);

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-5 h-10 flex items-center overflow-x-auto gap-0">
      <span className="text-[10px] font-mono font-semibold text-zinc-700 uppercase tracking-widest shrink-0 mr-3">
        Impact
      </span>

      <Stat value={stats.reviews} label="reviews" />
      <Divider />

      {/* Conventions */}
      <span className="flex items-center gap-2 shrink-0">
        <Stat value={conventions.length} label="conventions" />
        {conventions.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs">
            <TierChip count={blockConv}   tier="block" />
            <span className="text-zinc-800">·</span>
            <TierChip count={warnConv}    tier="warn" />
            <span className="text-zinc-800">·</span>
            <TierChip count={suggestConv} tier="suggest" />
          </span>
        )}
      </span>
      <Divider />

      {/* Issues */}
      <span className="flex items-center gap-2 shrink-0">
        <Stat value={stats.issues.total} label="issues caught" />
        {stats.issues.total > 0 && (
          <span className="flex items-center gap-1.5 text-xs">
            {stats.issues.block   > 0 && <TierChip count={stats.issues.block}   tier="block" />}
            {stats.issues.block   > 0 && stats.issues.warn > 0 && <span className="text-zinc-800">·</span>}
            {stats.issues.warn    > 0 && <TierChip count={stats.issues.warn}    tier="warn" />}
            {stats.issues.warn    > 0 && stats.issues.suggest > 0 && <span className="text-zinc-800">·</span>}
            {stats.issues.suggest > 0 && <TierChip count={stats.issues.suggest} tier="suggest" />}
          </span>
        )}
      </span>
      <Divider />

      {/* Acceptance */}
      {acceptancePct !== null ? (
        <Stat value={`${acceptancePct}%`} label="accepted" />
      ) : (
        <span className="text-zinc-700 text-xs font-mono shrink-0">no feedback yet</span>
      )}
      <Divider />

      <HealthBar score={health} />
    </div>
  );
}
