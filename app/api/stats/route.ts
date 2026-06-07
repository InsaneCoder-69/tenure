import { getRedis } from '@/lib/rate-limit';
import type { LiveStats } from '@/types';

// GET /api/stats
// Returns cumulative counters written by /api/review and /api/feedback.
export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: 'Stats unavailable' }, { status: 503 });
  }

  try {
    const [reviews, issTotal, issBlock, issWarn, issSuggest, fbAccepted, fbRejected] =
      await Promise.all([
        redis.get<number>('tenure:stats:reviews'),
        redis.get<number>('tenure:stats:issues:total'),
        redis.get<number>('tenure:stats:issues:block'),
        redis.get<number>('tenure:stats:issues:warn'),
        redis.get<number>('tenure:stats:issues:suggest'),
        redis.get<number>('tenure:stats:feedback:accepted'),
        redis.get<number>('tenure:stats:feedback:rejected'),
      ]);

    const n = (v: number | null) => v ?? 0;

    const stats: LiveStats = {
      reviews: n(reviews),
      issues: {
        total:   n(issTotal),
        block:   n(issBlock),
        warn:    n(issWarn),
        suggest: n(issSuggest),
      },
      feedback: {
        accepted: n(fbAccepted),
        rejected: n(fbRejected),
      },
    };

    return Response.json(stats);
  } catch (err) {
    console.error('[/api/stats] error:', err instanceof Error ? err.message : String(err));
    return Response.json({ error: 'Stats read failed' }, { status: 500 });
  }
}
