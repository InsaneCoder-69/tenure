'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReviewSession, TeamMemory, ReviewComment, Convention, FeedbackState } from '@/types';

export interface UseLiveReturn {
  session: ReviewSession;
  memory: TeamMemory;
  conventionMap: Map<string, Convention>;
  isLoadingReview: boolean;
  isLoadingMemory: boolean;
  isReviewing: boolean;
  error: string | null;
  feedbackStates: Record<string, FeedbackState>;
  handleFeedback: (comment: ReviewComment, accepted: boolean) => Promise<void>;
  submitDiff: (rawDiff: string, filePath: string) => Promise<void>;
}

function reconstructDiff(lines: import('@/types').DiffLine[]): string {
  return lines
    .map((line) => {
      if (line.type === 'header') return line.content;
      const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      return `${sign}${line.content}`;
    })
    .join('\n');
}

// Accept plain code or partial diffs by normalizing to unified diff format.
// Three cases:
//   1. Has @@ header → already a unified diff, pass through.
//   2. Has +/- markers but no @@ → add a minimal header.
//   3. Plain code, no markers → prefix every line with + and add a header.
function normalizeDiff(input: string): string {
  const lines = input.split('\n');
  if (lines.some((l) => l.startsWith('@@'))) return input;
  if (lines.some((l) => l.startsWith('+') || l.startsWith('-'))) {
    return `@@ -1,${lines.length} +1,${lines.length} @@\n${input}`;
  }
  const count = lines.length;
  return `@@ -0,0 +1,${count} @@\n${lines.map((l) => `+${l}`).join('\n')}`;
}

type DL = import('@/types').DiffLine;

function parseDiffLines(diff: string): DL[] {
  const result: DL[] = [];
  let newNo = 1;
  let oldNo = 1;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNo = parseInt(m[1], 10); newNo = parseInt(m[2], 10); }
      result.push({ type: 'header',  lineNo: null,    oldLineNo: null,    content: raw });
    } else if (raw.startsWith('+')) {
      result.push({ type: 'added',   lineNo: newNo++, oldLineNo: null,    content: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      result.push({ type: 'removed', lineNo: null,    oldLineNo: oldNo++, content: raw.slice(1) });
    } else {
      result.push({ type: 'context', lineNo: newNo++, oldLineNo: oldNo++, content: raw.startsWith(' ') ? raw.slice(1) : raw });
    }
  }
  return result;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function useLive(
  initialSession: ReviewSession,
  initialMemory: TeamMemory,
): UseLiveReturn {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [memory, setMemory] = useState<TeamMemory | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<string, FeedbackState>>({});

  // Refresh memory in the background after feedback.
  const refreshMemory = useCallback(() => {
    fetch('/api/memory', { headers: JSON_HEADERS })
      .then(async (res) => {
        if (res.ok) setMemory((await res.json()) as TeamMemory);
      })
      .catch(() => null);
  }, []);

  // On mount: fetch live review + memory in parallel.
  useEffect(() => {
    setIsLoadingReview(true);
    setIsLoadingMemory(true);

    const diff = reconstructDiff(initialSession.diff);

    Promise.allSettled([
      fetch('/api/review', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ diff, filePath: initialSession.filePath }),
      }),
      fetch('/api/memory', { headers: JSON_HEADERS }),
    ])
      .then(async ([reviewResult, memoryResult]) => {
        if (reviewResult.status === 'fulfilled' && reviewResult.value.ok) {
          const live = (await reviewResult.value.json()) as ReviewSession;
          setSession({ ...initialSession, id: live.id, comments: live.comments });
        } else {
          setSession(initialSession);
          setError('Live review unavailable — showing fixture comments');
        }
        setIsLoadingReview(false);

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
  }, []);

  const handleFeedback = useCallback(async (comment: ReviewComment, accepted: boolean) => {
    setFeedbackStates((prev) => ({ ...prev, [comment.id]: 'pending' }));
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: JSON_HEADERS,
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
  }, [refreshMemory]);

  // User-triggered review: accepts plain code or a unified diff — normalizes automatically.
  const submitDiff = useCallback(async (rawDiff: string, filePath: string) => {
    const diff = normalizeDiff(rawDiff);
    setIsReviewing(true);
    setError(null);
    setFeedbackStates({});
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ diff, filePath }),
      });
      if (res.ok) {
        const live = (await res.json()) as ReviewSession;
        setSession({ id: live.id, filePath, diff: parseDiffLines(diff), comments: live.comments });
      } else {
        const body = await res.text().catch(() => '(unreadable)');
        console.error('[tenure] /api/review failed:', res.status, body);
        setError(`Review failed (${res.status}) — see console for details`);
      }
    } catch (err) {
      console.error('[tenure] /api/review error:', err);
      setError('Failed to connect to live API');
    } finally {
      setIsReviewing(false);
    }
  }, []);

  const displaySession = session ?? initialSession;
  const displayMemory  = memory  ?? initialMemory;

  const conventionMap = useMemo(
    () => new Map<string, Convention>(displayMemory.conventions.map((c) => [c.id, c])),
    [displayMemory.conventions],
  );

  return {
    session: displaySession,
    memory:  displayMemory,
    conventionMap,
    isLoadingReview,
    isLoadingMemory,
    isReviewing,
    error,
    feedbackStates,
    handleFeedback,
    submitDiff,
  };
}
