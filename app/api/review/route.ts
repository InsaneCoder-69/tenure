import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { recall, listObservations } from '@/lib/hindsight';
import { generateReview, type ReviewConvention } from '@/lib/reviewer';
import { computeTier } from '@/lib/trust-tiers';
import { checkRateLimit, getRedis } from '@/lib/rate-limit';
import type { ReviewSession, ReviewComment, TrustTier, FreshnessTrend } from '@/types';

const CACHE_TTL_SECONDS = 3_600;

function parseTrend(raw: string | null | undefined): FreshnessTrend {
  if (raw === 'strengthening' || raw === 'stable' || raw === 'weakening' || raw === 'stale') {
    return raw;
  }
  return 'stable';
}

// POST /api/review
// Body:    { diff: string; filePath?: string }
// Returns: ReviewSession
export async function POST(req: NextRequest) {
  // Rate limit: 100 requests/day. Returns configured:false when Upstash env is absent.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';
  const rl = await checkRateLimit(ip, 'review');
  if (!rl.configured) {
    return Response.json({ error: 'Live mode unavailable.' }, { status: 503 });
  }
  if (!rl.allowed) {
    return Response.json(
      { error: 'Live demo limit reached.' },
      { status: 429, headers: { 'X-RateLimit-Reset': String(rl.reset) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const diff     = typeof body.diff     === 'string' ? body.diff.trim()     : '';
  const filePath = typeof body.filePath === 'string' ? body.filePath        : 'unknown';

  if (!diff) {
    return Response.json({ error: 'Body must include a non-empty diff string' }, { status: 400 });
  }

  try {
    // Cache check — skip gracefully when Redis is unavailable.
    const redis    = getRedis();
    const diffHash = createHash('sha256').update(diff).digest('hex').slice(0, 24);
    const cacheKey = `tenure:review:${diffHash}`;

    if (redis) {
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        const session = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return Response.json(session);
      }
    }

    // Parallel reads from Hindsight.
    const [acceptedResults, rejectedResults, observations] = await Promise.all([
      recall(diff, { types: ['world'],      tags: ['convention:accepted'], budget: 'mid' }),
      recall(diff, { types: ['experience'], tags: ['convention:rejected'], budget: 'low' }),
      listObservations({ limit: 50 }),
    ]);

    // Build observation index by document_id for proof-count + trend lookup.
    type ObsData = { proofCount: number; trend: FreshnessTrend };
    const obsIndex = new Map<string, ObsData>();

    for (const obs of observations) {
      if (!obs.document_id) continue;
      obsIndex.set(obs.document_id, {
        proofCount: obs.proof_count ?? 1,
        trend:      parseTrend(obs.freshness_trend),
      });
    }

    for (const r of acceptedResults) {
      const id = r.document_id ?? r.id;
      if (!obsIndex.has(id) && r.metadata?.proof_count) {
        const pc = parseInt(r.metadata.proof_count, 10);
        if (!isNaN(pc)) {
          obsIndex.set(id, { proofCount: pc, trend: parseTrend(r.metadata.trend) });
        }
      }
    }

    const rejectedIds   = new Set(rejectedResults.map((r) => r.document_id ?? r.id));
    const rejectedTexts = rejectedResults.map((r) => r.text);

    const conventions: ReviewConvention[] = acceptedResults
      .filter((r) => !rejectedIds.has(r.document_id ?? r.id))
      .map((r) => {
        const id = r.document_id ?? r.id;
        return { conventionId: id, text: r.text, proofCount: obsIndex.get(id)?.proofCount ?? 1 };
      });

    const tierMap = new Map<string, TrustTier>();
    for (const conv of conventions) {
      const obs = obsIndex.get(conv.conventionId);
      tierMap.set(conv.conventionId, computeTier(conv.proofCount, obs?.trend ?? 'stable'));
    }

    const { comments: rawComments } = await generateReview(diff, conventions, rejectedTexts);

    const comments: ReviewComment[] = rawComments
      .filter((c) => !c.conventionId || !rejectedIds.has(c.conventionId))
      .map((c, i) => {
        const tier: TrustTier = c.conventionId
          ? (tierMap.get(c.conventionId) ?? 'suggest')
          : 'suggest';
        const isKnown = !!c.conventionId && tierMap.has(c.conventionId);
        return {
          id:           `cmt-${diffHash.slice(0, 8)}-${i}`,
          lineNo:       c.line,
          text:         c.message,
          conventionId: c.conventionId ?? '',
          tier,
          rationale:    isKnown
            ? `Enforces established convention (${tier})`
            : 'Novel observation — not yet a tracked convention',
        };
      });

    const session: ReviewSession = {
      id:       `live-${diffHash.slice(0, 12)}`,
      filePath,
      diff:     [], // caller holds the raw diff; only comments are live-generated
      comments,
    };

    // Cache fire-and-forget — a write failure must never fail the response.
    if (redis) {
      redis.set(cacheKey, JSON.stringify(session), { ex: CACHE_TTL_SECONDS }).catch(() => null);
    }

    // Stats: increment counters — fire-and-forget via pipeline (one HTTP round-trip).
    if (redis && comments.length > 0) {
      const block   = comments.filter((c) => c.tier === 'block').length;
      const warn    = comments.filter((c) => c.tier === 'warn').length;
      const suggest = comments.filter((c) => c.tier === 'suggest').length;
      const p = redis.pipeline();
      p.incr('tenure:stats:reviews');
      p.incrby('tenure:stats:issues:total', comments.length);
      if (block)   p.incrby('tenure:stats:issues:block',   block);
      if (warn)    p.incrby('tenure:stats:issues:warn',    warn);
      if (suggest) p.incrby('tenure:stats:issues:suggest', suggest);
      p.exec().catch(() => null);
    } else if (redis) {
      redis.incr('tenure:stats:reviews').catch(() => null);
    }

    return Response.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack   : undefined;
    console.error('[/api/review] unhandled error:', stack ?? message);
    return Response.json({ error: message }, { status: 500 });
  }
}
