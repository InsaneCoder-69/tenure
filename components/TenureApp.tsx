'use client';

import { useMemo } from 'react';
import type { ReviewSession, TeamMemory, Convention } from '@/types';
import { useLive } from '@/hooks/useLive';
import ModeBar from './ModeBar';
import DiffPanel from './DiffPanel';
import MemoryPanel from './MemoryPanel';

interface TenureAppProps {
  session: ReviewSession;
  memory: TeamMemory;
}

export default function TenureApp({ session: initialSession, memory: initialMemory }: TenureAppProps) {
  const live = useLive(initialSession, initialMemory);

  const conventionMap = useMemo(
    () => new Map<string, Convention>(live.memory.conventions.map((c) => [c.id, c])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.memory.conventions],
  );

  const isLoading = live.isLoadingReview || live.isLoadingMemory;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <ModeBar />

      {live.error && (
        <div className="shrink-0 px-5 py-2 bg-amber-950/40 border-b border-amber-800/40 flex items-center gap-2">
          <span className="text-amber-400 text-xs font-mono">⚠ {live.error}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700/80 rounded-xl px-5 py-3 shadow-2xl">
              <span className="w-4 h-4 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
              <span className="text-sm text-zinc-400 font-mono">Running live review…</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden min-w-0 border-r border-zinc-800">
          <DiffPanel
            session={live.session}
            conventionMap={conventionMap}
            feedbackStates={live.feedbackStates}
            onFeedback={live.handleFeedback}
            onSubmitDiff={live.submitDiff}
            isReviewing={live.isReviewing}
          />
        </div>

        <div className="w-[400px] xl:w-[460px] shrink-0 overflow-hidden">
          <MemoryPanel memory={live.memory} highlightId={null} />
        </div>
      </div>
    </div>
  );
}
