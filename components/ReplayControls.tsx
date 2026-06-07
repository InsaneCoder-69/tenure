'use client';

import type { HeroMoment, ReplayPhase } from '@/lib/replay';
import { PHASE_LABEL, REPLAY_STEPS } from '@/lib/replay';

interface ReplayControlsProps {
  stepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  isComplete: boolean;
  isLoaded: boolean;
  phase: ReplayPhase;
  heroMoment: HeroMoment | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
}

const HERO_COLORS: Record<HeroMoment['id'], { bar: string; title: string; dot: string }> = {
  'first-block':   { bar: 'border-rose-700/60 bg-rose-950/80',   title: 'text-rose-300',   dot: 'bg-rose-400'   },
  'tier-promoted': { bar: 'border-amber-700/60 bg-amber-950/80', title: 'text-amber-300',  dot: 'bg-amber-400'  },
  'memory-learned':{ bar: 'border-sky-700/60 bg-sky-950/80',     title: 'text-sky-300',    dot: 'bg-sky-400'    },
};

export default function ReplayControls({
  stepIndex,
  totalSteps,
  isPlaying,
  isComplete,
  isLoaded,
  phase,
  heroMoment,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onReset,
}: ReplayControlsProps) {
  const isIdle = phase === 'idle';

  // ── idle / loading state: just show "Run Demo" ────────────────────────────
  if (isIdle) {
    return (
      <div className="fixed bottom-0 inset-x-0 flex justify-center pb-6 pointer-events-none z-40">
        <button
          onClick={onPlay}
          disabled={!isLoaded}
          className="pointer-events-auto flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm
            bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white
            shadow-lg shadow-emerald-900/40 border border-emerald-500/40
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150"
        >
          {/* play triangle */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          {isLoaded ? 'Run Demo' : 'Loading…'}
        </button>
      </div>
    );
  }

  const heroCfg = heroMoment ? HERO_COLORS[heroMoment.id] : null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      {/* ── hero moment toast ─────────────────────────────────────────────── */}
      {heroMoment && heroCfg && (
        <div className="flex justify-center mb-3 px-4 pointer-events-none">
          <div
            className={`pointer-events-auto flex items-start gap-3 max-w-md w-full rounded-xl px-4 py-3
              border backdrop-blur-sm shadow-xl ${heroCfg.bar}`}
          >
            <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${heroCfg.dot}`} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-snug ${heroCfg.title}`}>
                {heroMoment.title}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{heroMoment.body}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── control bar ───────────────────────────────────────────────────── */}
      <div className="flex justify-center pb-4 px-4">
        <div
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl
            bg-zinc-900/95 border border-zinc-700/60 shadow-xl backdrop-blur-sm"
        >
          {/* Prev */}
          <button
            onClick={onPrev}
            disabled={stepIndex === 0}
            title="Previous step"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>

          {/* Play / Pause */}
          {isComplete ? (
            <button
              onClick={onReset}
              title="Reset demo"
              className="p-1.5 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1,4 1,10 7,10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
              </svg>
            </button>
          ) : isPlaying ? (
            <button
              onClick={onPause}
              title="Pause"
              className="p-1.5 rounded-md text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPlay}
              title="Play"
              className="p-1.5 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          )}

          {/* Next */}
          <button
            onClick={onNext}
            disabled={isComplete}
            title="Next step"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </button>

          {/* Divider */}
          <span className="w-px h-5 bg-zinc-700" />

          {/* Step dots */}
          <div className="flex items-center gap-1">
            {REPLAY_STEPS_DOTS.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-3 h-2 bg-emerald-400'
                    : i < stepIndex
                    ? 'w-2 h-2 bg-zinc-500'
                    : 'w-2 h-2 bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {/* Divider */}
          <span className="w-px h-5 bg-zinc-700" />

          {/* Phase label */}
          <span className="text-xs font-mono text-zinc-500 min-w-[90px]">
            {PHASE_LABEL[phase]}
          </span>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset to start"
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,4 1,10 7,10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const REPLAY_STEPS_DOTS = REPLAY_STEPS;
