'use client';

import { useRef, useState, useEffect } from 'react';
import type { TeamMemory, Convention, TrustTier } from '@/types';
import { TIER_CONFIG } from '@/lib/trust-tiers';
import TrustBadge from './TrustBadge';
import TrendIcon from './TrendIcon';

// ── tier-transition types ─────────────────────────────────────────────────────

const TIER_ORDER: Record<TrustTier, number> = { suggest: 0, warn: 1, block: 2 };
const PROMOTION_MS = 6_500;
const DEMOTION_MS  = 5_000;
// Exit animation is 400 ms, so start dismissing this long before full duration.
const EXIT_LEAD_MS = 420;

interface TierTransition {
  id:             string;
  conventionText: string;
  fromTier:       TrustTier;
  toTier:         TrustTier;
  proofCount:     number;
  trend:          string;
  direction:      'up' | 'down';
  key:            string;    // `${id}-${timestamp}` — unique per event
  dismissing:     boolean;
}

// ── callout copy ──────────────────────────────────────────────────────────────

function calloutTitle(direction: 'up' | 'down', toTier: TrustTier): string {
  if (direction === 'up') {
    if (toTier === 'block') return 'Promoted to BLOCK';
    if (toTier === 'warn')  return 'Promoted to WARN';
    return 'Raised to SUGGEST';
  }
  if (toTier === 'warn') return 'Demoted to WARN';
  return 'Demoted to SUGGEST';
}

function calloutBody(direction: 'up' | 'down', toTier: TrustTier): string {
  if (direction === 'up') {
    if (toTier === 'block') return 'Now gates all merges — PRs with this violation will be blocked';
    if (toTier === 'warn')  return 'Now triggers warnings on every PR — evidence is building';
    return 'Tenure is tracking this pattern; more violations will raise the tier';
  }
  if (toTier === 'warn') return 'Trend weakening — warnings continue but merges are no longer blocked';
  return 'Insufficient evidence — Tenure will keep watching';
}

// ── callout colour config ─────────────────────────────────────────────────────

interface Palette {
  border: string; bg: string; accent: string;
  title:  string; body:  string; bar:    string; arrow: string;
}

function palette(direction: 'up' | 'down', toTier: TrustTier): Palette {
  if (direction === 'up' && toTier === 'block') return {
    border: 'border-rose-600/70',   bg:    'bg-rose-950/85',
    accent: 'bg-rose-500',          title: 'text-rose-200',
    body:   'text-rose-400/90',     bar:   'bg-rose-600/70',
    arrow:  'text-rose-400',
  };
  if (direction === 'up' && toTier === 'warn') return {
    border: 'border-amber-600/60',  bg:    'bg-amber-950/80',
    accent: 'bg-amber-500',         title: 'text-amber-200',
    body:   'text-amber-400/90',    bar:   'bg-amber-600/60',
    arrow:  'text-amber-400',
  };
  if (direction === 'up') return {
    border: 'border-sky-600/60',    bg:    'bg-sky-950/80',
    accent: 'bg-sky-500',           title: 'text-sky-200',
    body:   'text-sky-400/90',      bar:   'bg-sky-600/60',
    arrow:  'text-sky-400',
  };
  // demotion
  return {
    border: 'border-zinc-600/50',   bg:    'bg-zinc-900/90',
    accent: 'bg-zinc-600',          title: 'text-zinc-300',
    body:   'text-zinc-500',        bar:   'bg-zinc-700/60',
    arrow:  'text-zinc-500',
  };
}

// ── TierCallout ───────────────────────────────────────────────────────────────

function TierCallout({
  t,
  duration,
  onDismiss,
}: {
  t:         TierTransition;
  duration:  number;
  onDismiss: (key: string) => void;
}) {
  const p     = palette(t.direction, t.toTier);
  const title = calloutTitle(t.direction, t.toTier);
  const body  = calloutBody(t.direction, t.toTier);
  const short = t.conventionText.length > 74
    ? t.conventionText.slice(0, 71) + '…'
    : t.conventionText;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 ${p.border} ${p.bg} backdrop-blur-sm mb-3 shadow-lg`}
      style={{
        animation: t.dismissing
          ? 'callout-exit 0.4s cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'callout-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Vertical accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${p.accent}`} />

      <div className="pl-4 pr-3 pt-3.5 pb-3">
        {/* Row 1: arrow + tier label + badge + close */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-lg font-bold leading-none shrink-0 ${p.arrow}`}>
              {t.direction === 'up' ? '▲' : '▼'}
            </span>
            <span className={`text-sm font-bold font-mono tracking-wide uppercase ${p.title}`}>
              {title}
            </span>
            <TrustBadge tier={t.toTier} size="sm" />
          </div>
          <button
            onClick={() => onDismiss(t.key)}
            className="text-zinc-700 hover:text-zinc-400 transition-colors text-sm leading-none shrink-0 ml-1"
            aria-label="Dismiss callout"
          >
            ✕
          </button>
        </div>

        {/* Convention text */}
        <p className="text-sm text-zinc-100 font-medium leading-snug mb-2">{short}</p>

        {/* Action sentence */}
        <p className={`text-xs font-mono leading-relaxed ${p.body} mb-2`}>{body}</p>

        {/* Metadata line */}
        <p className="text-[11px] font-mono text-zinc-600">
          was{' '}
          <span className="uppercase text-zinc-500">{t.fromTier}</span>
          {' · '}{t.proofCount} proof{t.proofCount !== 1 ? 's' : ''}
          {' · '}{t.trend}
        </p>
      </div>

      {/* Auto-dismiss progress bar */}
      {!t.dismissing && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${p.bar}`}
          style={{ animation: `drain-progress ${duration}ms linear forwards` }}
        />
      )}
    </div>
  );
}

// ── row ring helper ───────────────────────────────────────────────────────────

function rowRingCls(
  highlighted:      boolean,
  activeTransition: TierTransition | null,
): string {
  if (activeTransition) {
    if (activeTransition.direction === 'up') {
      if (activeTransition.toTier === 'block')
        return 'ring-2 ring-rose-500/60   bg-rose-950/25   px-2 -mx-2';
      if (activeTransition.toTier === 'warn')
        return 'ring-2 ring-amber-500/60  bg-amber-950/25  px-2 -mx-2';
      return   'ring-2 ring-sky-500/60    bg-sky-950/25    px-2 -mx-2';
    }
    return 'ring-1 ring-zinc-500/50 bg-zinc-800/20 px-2 -mx-2';
  }
  if (highlighted) return 'ring-1 ring-emerald-500/50 bg-emerald-950/20 px-2 -mx-2';
  return '';
}

// ── ConventionRow ─────────────────────────────────────────────────────────────

function ConventionRow({
  convention,
  highlighted,
  activeTransition,
}: {
  convention:       Convention;
  highlighted:      boolean;
  activeTransition: TierTransition | null;
}) {
  const isJustPromoted = activeTransition?.direction === 'up';
  const isJustDemoted  = activeTransition?.direction === 'down';
  const isDemoted      = convention.trend === 'weakening' || convention.trend === 'stale';
  const ringCls        = rowRingCls(highlighted, activeTransition);

  return (
    <div
      className={`flex items-start gap-2 py-2.5 border-b border-zinc-800/60 last:border-0 rounded-md transition-all duration-500 ${ringCls}`}
      style={
        activeTransition
          ? {
              animation:
                activeTransition.toTier === 'block'
                  ? 'row-glow-block 1.4s ease-in-out 3'
                  : activeTransition.toTier === 'warn'
                  ? 'row-glow-warn 1.4s ease-in-out 3'
                  : undefined,
            }
          : undefined
      }
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 leading-snug">{convention.text}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-zinc-600 font-mono">{convention.category}</span>

          {isJustPromoted && (
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-px rounded border leading-none ${
                convention.tier === 'block'
                  ? 'text-rose-300  bg-rose-950/60   border-rose-700/50'
                  : convention.tier === 'warn'
                  ? 'text-amber-300 bg-amber-950/60  border-amber-700/50'
                  : 'text-sky-300   bg-sky-950/60    border-sky-700/50'
              }`}
            >
              ▲ promoted
            </span>
          )}

          {isJustDemoted && (
            <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 px-1.5 py-px rounded leading-none">
              ▼ demoted
            </span>
          )}

          {!isJustPromoted && !isJustDemoted && isDemoted && (
            <span className="text-[10px] font-mono text-amber-600 bg-amber-950/30 border border-amber-900/40 px-1 py-px rounded leading-none">
              demoted
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        <span className="text-xs text-zinc-600 font-mono tabular-nums">{convention.proofCount}</span>
        <TrendIcon trend={convention.trend} />
        <TrustBadge tier={convention.tier} size="sm" />
      </div>
    </div>
  );
}

// ── TierGroup ─────────────────────────────────────────────────────────────────

function TierGroup({
  tier,
  conventions,
  highlightId,
  activeTransitions,
}: {
  tier:              TrustTier;
  conventions:       Convention[];
  highlightId?:      string | null;
  activeTransitions: Map<string, TierTransition>;
}) {
  if (conventions.length === 0) return null;
  const cfg = TIER_CONFIG[tier];
  return (
    <div className="mb-4">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md mb-1 ${cfg.bg} border ${cfg.border}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-xs font-mono font-semibold ${cfg.color}`}>
          {cfg.label.toUpperCase()}
        </span>
        <span className="text-xs text-zinc-600 ml-auto">{cfg.description}</span>
        <span className={`text-xs font-mono ${cfg.color} opacity-70`}>{conventions.length}</span>
      </div>
      <div className="px-1">
        {conventions.map((c) => (
          <ConventionRow
            key={c.id}
            convention={c}
            highlighted={c.id === highlightId}
            activeTransition={activeTransitions.get(c.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

// ── MemoryPanel ───────────────────────────────────────────────────────────────

interface MemoryPanelProps {
  memory:      TeamMemory;
  highlightId?: string | null;
}

export default function MemoryPanel({ memory, highlightId }: MemoryPanelProps) {
  // Track previous tier per convention to detect transitions across renders.
  const prevDataRef = useRef<Map<string, { tier: TrustTier; proofCount: number; trend: string }>>(new Map());
  const [callouts, setCallouts]   = useState<TierTransition[]>([]);
  const dismissTimers             = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const calloutsRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev   = prevDataRef.current;
    const events: TierTransition[] = [];

    for (const conv of memory.conventions) {
      const p = prev.get(conv.id);
      if (p !== undefined && p.tier !== conv.tier) {
        events.push({
          id:             conv.id,
          conventionText: conv.text,
          fromTier:       p.tier,
          toTier:         conv.tier,
          proofCount:     conv.proofCount,
          trend:          conv.trend,
          direction:      TIER_ORDER[conv.tier] > TIER_ORDER[p.tier] ? 'up' : 'down',
          key:            `${conv.id}-${Date.now()}`,
          dismissing:     false,
        });
      }
      prev.set(conv.id, { tier: conv.tier, proofCount: conv.proofCount, trend: conv.trend });
    }

    if (events.length === 0) return;

    setCallouts((cs) => [...cs, ...events]);

    // Scroll the callout zone into view so it's impossible to miss.
    requestAnimationFrame(() => {
      calloutsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    for (const ev of events) {
      const dur = ev.direction === 'up' ? PROMOTION_MS : DEMOTION_MS;
      const t   = setTimeout(() => {
        setCallouts((cs) => cs.map((c) => c.key === ev.key ? { ...c, dismissing: true } : c));
        setTimeout(() => setCallouts((cs) => cs.filter((c) => c.key !== ev.key)), EXIT_LEAD_MS);
      }, dur - EXIT_LEAD_MS);
      dismissTimers.current.set(ev.key, t);
    }
  }, [memory.conventions]); // runs when conventions array reference changes

  // Clean up all pending timers on unmount.
  useEffect(() => {
    const timers = dismissTimers.current;
    return () => { for (const t of timers.values()) clearTimeout(t); };
  }, []);

  function handleDismiss(key: string) {
    const t = dismissTimers.current.get(key);
    if (t) clearTimeout(t);
    dismissTimers.current.delete(key);
    setCallouts((cs) => cs.map((c) => c.key === key ? { ...c, dismissing: true } : c));
    setTimeout(() => setCallouts((cs) => cs.filter((c) => c.key !== key)), EXIT_LEAD_MS);
  }

  // Non-dismissing callouts drive the row-level glow.
  const activeTransitions = new Map<string, TierTransition>(
    callouts.filter((c) => !c.dismissing).map((c) => [c.id, c]),
  );

  const byTier = {
    block:   memory.conventions.filter((c) => c.tier === 'block').sort((a, b) => b.proofCount - a.proofCount),
    warn:    memory.conventions.filter((c) => c.tier === 'warn').sort((a, b) => b.proofCount - a.proofCount),
    suggest: memory.conventions.filter((c) => c.tier === 'suggest').sort((a, b) => b.proofCount - a.proofCount),
  };

  const updated = new Date(memory.lastUpdated).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Team Memory</h2>
          <span className="text-xs text-zinc-600 font-mono">updated {updated}</span>
        </div>
        <p className="text-xs text-zinc-600 mt-0.5">
          Conventions earned by consensus · trust tiers by proof-count + trend
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Conventions by tier */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Conventions
          </h3>

          {/* Callout zone — anchors scrollIntoView */}
          <div ref={calloutsRef}>
            {callouts.map((t) => (
              <TierCallout
                key={t.key}
                t={t}
                duration={t.direction === 'up' ? PROMOTION_MS : DEMOTION_MS}
                onDismiss={handleDismiss}
              />
            ))}
          </div>

          <TierGroup tier="block"   conventions={byTier.block}   highlightId={highlightId} activeTransitions={activeTransitions} />
          <TierGroup tier="warn"    conventions={byTier.warn}    highlightId={highlightId} activeTransitions={activeTransitions} />
          <TierGroup tier="suggest" conventions={byTier.suggest} highlightId={highlightId} activeTransitions={activeTransitions} />
        </section>

        {/* Observations */}
        {memory.observations.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Observations
            </h3>
            <div className="space-y-2">
              {memory.observations.map((obs) => (
                <div key={obs.id} className="bg-zinc-800/30 border border-zinc-800 rounded-lg px-3 py-2.5">
                  <p className="text-sm text-zinc-300 leading-relaxed">{obs.text}</p>
                  {obs.proofCount !== undefined && obs.trend && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-zinc-600 font-mono">{obs.proofCount} supporting facts</span>
                      <TrendIcon trend={obs.trend} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Self-writing style guide */}
        {memory.styleGuide.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Style Guide
              <span className="ml-2 text-zinc-700 normal-case font-normal">self-written by Tenure</span>
            </h3>
            <ul className="space-y-2">
              {memory.styleGuide.map((rule, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-400 leading-relaxed">
                  <span className="text-zinc-700 shrink-0 font-mono mt-px">
                    {String(i + 1).padStart(2, '0')}.
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
