import type { NextRequest } from 'next/server';
import type { Redis } from '@upstash/redis';
import { listObservations, reflect } from '@/lib/hindsight';
import { computeTier } from '@/lib/trust-tiers';
import { checkRateLimit, getRedis } from '@/lib/rate-limit';
import type { Convention, Observation, TeamMemory, FreshnessTrend, TrustTier } from '@/types';
import type { ObservationItem } from '@/lib/hindsight';

// reflect() is expensive — cache its output for 5 minutes.
const STYLE_GUIDE_CACHE_KEY  = 'tenure:style-guide';
const STYLE_GUIDE_TTL_SECONDS = 300;

function parseTrend(raw: string | null | undefined): FreshnessTrend {
  if (raw === 'strengthening' || raw === 'stable' || raw === 'weakening' || raw === 'stale') return raw;
  return 'stable';
}

function deriveCategory(obs: ObservationItem): string {
  const categoryTag = obs.tags.find((t) => t.startsWith('category:'));
  if (categoryTag) return categoryTag.slice('category:'.length);
  const text = obs.text.toLowerCase();
  if (/\bany\b|type\b|generic|interface|enum/.test(text))    return 'types';
  if (/async|await|promise|try.catch|error/.test(text))      return 'async';
  if (/hook|useEffect|useState|component/.test(text))        return 'react';
  if (/console|log|warn|debug/.test(text))                   return 'logging';
  if (/name|naming|prefix|suffix|casing/.test(text))        return 'naming';
  if (/import|export|module/.test(text))                     return 'modules';
  return 'general';
}

function parseStyleGuide(reflectText: string): string[] {
  return reflectText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter((l) => l.length > 10)
    .slice(0, 8);
}

// Serve the style guide from cache when possible; call reflect() only on miss.
// Pass `redis: null` to skip caching entirely (Upstash available but cache opt-out not used).
async function getStyleGuide(redis: Redis | null): Promise<string[]> {
  if (redis) {
    const cached = await redis.get<string>(STYLE_GUIDE_CACHE_KEY).catch(() => null);
    if (cached) {
      try { return JSON.parse(cached) as string[]; } catch { /* corrupt — fall through */ }
    }
  }

  const { text } = await reflect(
    "Summarize this team's coding style as a short bullet-point guide. " +
      'Maximum 8 rules, one sentence each. ' +
      'Focus on conventions with the highest consensus. ' +
      'Use plain language — no preamble, no headers, just the rules.',
    { budget: 'low' },
  );

  const guide = parseStyleGuide(text);

  // Fire-and-forget cache write — must never block the response.
  if (redis) {
    redis.set(STYLE_GUIDE_CACHE_KEY, JSON.stringify(guide), { ex: STYLE_GUIDE_TTL_SECONDS })
      .catch(() => null);
  }

  return guide;
}

// GET /api/memory
// Returns: TeamMemory
export async function GET(req: NextRequest) {
  // Rate limit: 30 requests/day.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';
  const rl = await checkRateLimit(ip, 'memory');
  if (!rl.configured) {
    return Response.json({ error: 'Live mode unavailable.' }, { status: 503 });
  }
  if (!rl.allowed) {
    return Response.json(
      { error: 'Live demo limit reached.' },
      { status: 429, headers: { 'X-RateLimit-Reset': String(rl.reset) } },
    );
  }

  // getRedis() reuses the same lazy singleton as the rate limiter.
  const redis = getRedis();

  const [observations, styleGuide] = await Promise.all([
    listObservations({ limit: 100 }),
    getStyleGuide(redis),
  ]);

  const conventions: Convention[] = observations
    .filter((obs) => obs.text.trim().length > 0)
    .map((obs): Convention => {
      const proofCount = obs.proof_count ?? 1;
      const trend      = parseTrend(obs.freshness_trend);
      return {
        id: obs.document_id ?? obs.id,
        text: obs.text,
        tier: computeTier(proofCount, trend) as TrustTier,
        proofCount,
        trend,
        category: deriveCategory(obs),
      };
    })
    .sort((a, b) => {
      const order: Record<TrustTier, number> = { block: 0, warn: 1, suggest: 2 };
      const d = order[a.tier] - order[b.tier];
      return d !== 0 ? d : b.proofCount - a.proofCount;
    });

  const observationItems: Observation[] = observations
    .filter((obs) => obs.text.trim().length > 0)
    .map((obs): Observation => ({
      id:         obs.id,
      text:       obs.text,
      type:       'observation',
      proofCount: obs.proof_count ?? undefined,
      trend:      obs.freshness_trend ? parseTrend(obs.freshness_trend) : undefined,
    }));

  const memory: TeamMemory = {
    conventions,
    observations: observationItems,
    styleGuide,
    lastUpdated: new Date().toISOString(),
  };

  return Response.json(memory);
}
