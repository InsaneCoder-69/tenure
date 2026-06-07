'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReviewSession, TeamMemory, Convention } from '@/types';
import { computeTier } from '@/lib/trust-tiers';
import {
  REPLAY_STEPS,
  type ReplayStep,
  type HeroMoment,
  type ReplayPhase,
  type ConventionPatch,
} from '@/lib/replay';

// ── types ─────────────────────────────────────────────────────────────────────

export interface UseReplayReturn {
  isLoaded: boolean;
  session: ReviewSession | null;
  memory: TeamMemory | null;
  highlightConventionId: string | null;
  heroMoment: HeroMoment | null;
  phase: ReplayPhase;
  stepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  isComplete: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function applyPatches(base: TeamMemory, step: ReplayStep): TeamMemory {
  const patches = step.conventionPatches;
  const hasPatches = Object.keys(patches).length > 0;

  const conventions: Convention[] = hasPatches
    ? base.conventions.map((c) => {
        const p: ConventionPatch | undefined = patches[c.id];
        if (!p) return c;
        const proofCount = p.proofCount ?? c.proofCount;
        const trend = p.trend ?? c.trend;
        const tier = p.tier ?? computeTier(proofCount, trend);
        return { ...c, proofCount, trend, tier };
      })
    : base.conventions;

  const styleGuide =
    step.styleGuideAppend && !base.styleGuide.includes(step.styleGuideAppend)
      ? [...base.styleGuide, step.styleGuideAppend]
      : base.styleGuide;

  return { ...base, conventions, styleGuide };
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useReplay(): UseReplayReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [baseSession, setBaseSession] = useState<ReviewSession | null>(null);
  const [baseMemory, setBaseMemory] = useState<TeamMemory | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load fixtures on mount ─────────────────────────────────────────────────
  // These fetches target /public static assets — zero calls to any API route.
  useEffect(() => {
    const load = async () => {
      const [sessionRes, memoryRes, observationsRes, styleguideRes] = await Promise.all([
        fetch('/fixtures/session.json'),
        fetch('/fixtures/memory.json'),
        fetch('/fixtures/observations.json'),
        fetch('/fixtures/styleguide.txt'),
      ]);

      const [session, memory, observations, styleguideTxt] = await Promise.all([
        sessionRes.json() as Promise<ReviewSession>,
        memoryRes.json() as Promise<TeamMemory>,
        observationsRes.json(),
        styleguideRes.text(),
      ]);

      const styleGuide = styleguideTxt
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      setBaseSession(session);
      // Merge the separately-loaded observations and style guide into the base memory.
      setBaseMemory({ ...memory, observations, styleGuide });
      setIsLoaded(true);
    };

    load().catch((err) => console.error('[useReplay] fixture load failed:', err));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── auto-advance ──────────────────────────────────────────────────────────
  const currentStep = REPLAY_STEPS[stepIndex];
  const isLastStep = stepIndex === REPLAY_STEPS.length - 1;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPlaying || currentStep.autoAdvanceMs === 0 || isLastStep) return;

    timerRef.current = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, REPLAY_STEPS.length - 1));
    }, currentStep.autoAdvanceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIndex, currentStep, isLastStep]);

  // When auto-advance lands on the last step, stop playing.
  useEffect(() => {
    if (isLastStep && isPlaying) setIsPlaying(false);
  }, [isLastStep, isPlaying]);

  // ── actions ───────────────────────────────────────────────────────────────
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const play = useCallback(() => {
    // If on the idle step, skip straight to scanning.
    setStepIndex((i) => (i === 0 ? 1 : i));
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, []);

  const next = useCallback(() => {
    clearTimer();
    setStepIndex((i) => Math.min(i + 1, REPLAY_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    clearTimer();
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setStepIndex(0);
    setIsPlaying(false);
  }, []);

  // ── derived display state ─────────────────────────────────────────────────

  const session: ReviewSession | null = baseSession
    ? {
        ...baseSession,
        comments: baseSession.comments.filter((c) =>
          currentStep.visibleCommentIds.includes(c.id),
        ),
      }
    : null;

  const memory: TeamMemory | null = baseMemory ? applyPatches(baseMemory, currentStep) : null;

  return {
    isLoaded,
    session,
    memory,
    highlightConventionId: currentStep.highlightConventionId,
    heroMoment: currentStep.heroMoment,
    phase: currentStep.phase,
    stepIndex,
    totalSteps: REPLAY_STEPS.length,
    isPlaying,
    isComplete: isLastStep,
    play,
    pause,
    next,
    prev,
    reset,
  };
}
