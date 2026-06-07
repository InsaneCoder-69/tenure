'use client';

import { useState, useMemo } from 'react';
import type { AppMode, ReviewSession, TeamMemory, Convention } from '@/types';
import { useReplay } from '@/hooks/useReplay';
import { useLive } from '@/hooks/useLive';
import ModeBar from './ModeBar';
import DiffPanel from './DiffPanel';
import MemoryPanel from './MemoryPanel';
import UnlockModal from './UnlockModal';
import ReplayControls from './ReplayControls';

interface TenureAppProps {
  mode: AppMode;
  session: ReviewSession;
  memory: TeamMemory;
}

export default function TenureApp({ mode, session: initialSession, memory: initialMemory }: TenureAppProps) {
  const [unlockOpen, setUnlockOpen] = useState(false);

  // Both hooks always run (React rules). Each is a no-op when its mode is inactive.
  const replay = useReplay();
  const live   = useLive(initialSession, initialMemory, mode === 'live');

  const isReplay = mode === 'replay';

  const displaySession: ReviewSession = isReplay
    ? (replay.session ?? initialSession)
    : live.session;

  const displayMemory: TeamMemory = isReplay
    ? (replay.memory ?? initialMemory)
    : live.memory;

  const highlightId    = isReplay ? replay.highlightConventionId : null;
  const feedbackStates = !isReplay ? live.feedbackStates : undefined;
  const onFeedback     = !isReplay ? live.handleFeedback : undefined;

  // Convention map built from whichever memory is active — used in both modes for "based on" text.
  const conventionMap = useMemo(
    () => new Map<string, Convention>(displayMemory.conventions.map((c) => [c.id, c])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayMemory.conventions],
  );

  // Show a loading veil only during the initial LIVE review+memory fetch.
  const isLiveLoading = !isReplay && (live.isLoadingReview || live.isLoadingMemory);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <ModeBar mode={mode} onUnlockClick={() => setUnlockOpen(true)} />

      {/* Error banner (LIVE only, non-fatal) */}
      {!isReplay && live.error && (
        <div className="shrink-0 px-5 py-2 bg-amber-950/40 border-b border-amber-800/40 flex items-center gap-2">
          <span className="text-amber-400 text-xs font-mono">⚠ {live.error}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Loading veil — shown only on first LIVE load */}
        {isLiveLoading && (
          <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700/80 rounded-xl px-5 py-3 shadow-2xl">
              <span className="w-4 h-4 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
              <span className="text-sm text-zinc-400 font-mono">Running live review…</span>
            </div>
          </div>
        )}

        {/* Left: diff + inline comments */}
        <div className="flex-1 overflow-hidden min-w-0 border-r border-zinc-800">
          <DiffPanel
            session={displaySession}
            conventionMap={conventionMap}
            feedbackStates={feedbackStates}
            onFeedback={onFeedback}
          />
        </div>

        {/* Right: team memory */}
        <div className="w-[400px] xl:w-[460px] shrink-0 overflow-hidden">
          <MemoryPanel memory={displayMemory} highlightId={highlightId} />
        </div>
      </div>

      {unlockOpen && (
        <UnlockModal onClose={() => setUnlockOpen(false)} />
      )}

      {isReplay && (
        <ReplayControls
          stepIndex={replay.stepIndex}
          totalSteps={replay.totalSteps}
          isPlaying={replay.isPlaying}
          isComplete={replay.isComplete}
          isLoaded={replay.isLoaded}
          phase={replay.phase}
          heroMoment={replay.heroMoment}
          onPlay={replay.play}
          onPause={replay.pause}
          onNext={replay.next}
          onPrev={replay.prev}
          onReset={replay.reset}
        />
      )}
    </div>
  );
}
