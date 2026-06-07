'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReviewSession, TeamMemory, ReviewComment, Convention, DiffLine, FeedbackState } from '@/types';

export interface UseLiveReturn {
  session: ReviewSession;
  memory: TeamMemory;
  conventionMap: Map<string, Convention>;
  isLoadingReview: boolean;
  isLoadingMemory: boolean;
  error: string | null;
  feedbackStates: Record<string, FeedbackState>;
  handleFeedback: (comment: ReviewComment, accepted: boolean) => Promise<void>;
}

function reconstructDiff(lines: DiffLine[]): string {
  return lines
    .map((line) => {
      if (line.type === 'header') return line.content;
      const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      return `${sign}${line.content}`;
    })
    .join('\n');
}

export function useLive(
  initialSession: ReviewSession,
  initialMemory: TeamMemory,
  enabled: boolean,
): UseLiveReturn {
  // Passphrase is stable for the session lifetime — read once from URL on mount.
  const [passphrase] = useState<string>(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('passphrase') ?? ''
      : '',
  );

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [memory, setMemory] = useState<TeamMemory | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<string, FeedbackState>>({});

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', 'x-tenure-passphrase': passphrase }),
    [passphrase],
  );

  // Refresh memory in the background (called after successful feedback).
  const refreshMemory = useCallback(() => {
    fetch('/api/memory', { headers: authHeaders })
      .then(async (res) => {
        if (res.ok) setMemory((await res.json()) as TeamMemory);
      })
      .catch(() => null);
  }, [authHeaders]);

  // On mount: fetch live review + memory in parallel.
  useEffect(() => {
    if (!enabled) return;

    setIsLoadingReview(true);
    setIsLoadingMemory(true);

    const diff = reconstructDiff(initialSession.diff);

    Promise.allSettled([
      fetch('/api/review', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ diff, filePath: initialSession.filePath }),
      }),
      fetch('/api/memory', { headers: authHeaders }),
    ])
      .then(async ([reviewResult, memoryResult]) => {
        // Review: merge live comments onto the fixture diff lines.
        if (reviewResult.status === 'fulfilled' && reviewResult.value.ok) {
          const live = (await reviewResult.value.json()) as ReviewSession;
          setSession({ ...initialSession, id: live.id, comments: live.comments });
        } else {
          setSession(initialSession);
          setError('Live review unavailable — showing fixture comments');
        }
        setIsLoadingReview(false);

        // Memory: use live data, fall back to fixture.
        if (memoryResult.status === 'fulfilled' && memoryResult.value.ok) {
          setMemory((await memoryResult.value.json()) as TeamMemory);
        } else {
          setMemory(initialMemory);
        }
        setIsLoadingMemory(false);
      })
      .catch(() => {
        setSession(initialSession);
        setMemory(initialMemory);
        setIsLoadingReview(false);
        setIsLoadingMemory(false);
        setError('Failed to connect to live API');
      });
    // Intentional: run once on mount. initialSession/initialMemory are stable server props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleFeedback = useCallback(
    async (comment: ReviewComment, accepted: boolean) => {
      setFeedbackStates((prev) => ({ ...prev, [comment.id]: 'pending' }));
      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ comment, accepted }),
        });
        setFeedbackStates((prev) => ({
          ...prev,
          [comment.id]: res.ok ? (accepted ? 'accepted' : 'rejected') : 'idle',
        }));
        if (res.ok) refreshMemory();
      } catch {
        setFeedbackStates((prev) => ({ ...prev, [comment.id]: 'idle' }));
      }
    },
    [authHeaders, refreshMemory],
  );

  const displaySession = session ?? initialSession;
  const displayMemory = memory ?? initialMemory;

  const conventionMap = useMemo(
    () => new Map<string, Convention>(displayMemory.conventions.map((c) => [c.id, c])),
    [displayMemory.conventions],
  );

  return {
    session: displaySession,
    memory: displayMemory,
    conventionMap,
    isLoadingReview,
    isLoadingMemory,
    error,
    feedbackStates,
    handleFeedback,
  };
}
