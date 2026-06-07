import type { NextRequest } from 'next/server';
import {
  retainWorldFact,
  retainExperienceFact,
  waitForProcessing,
  recall,
} from '@/lib/hindsight';
import { checkRateLimit } from '@/lib/rate-limit';
import type { ReviewComment } from '@/types';

function extractPassphrase(req: NextRequest): string {
  return (
    new URL(req.url).searchParams.get('passphrase') ??
    req.headers.get('x-tenure-passphrase') ??
    ''
  );
}

function validPassphrase(p: string): boolean {
  return !!process.env.LIVE_MODE_PASSPHRASE && p === process.env.LIVE_MODE_PASSPHRASE;
}

interface ObservationUpdate { text: string; proofCount: number; trend: string; }
interface FeedbackResponse  { retained: boolean; pending: boolean; observation: ObservationUpdate | null; }

// POST /api/feedback
// Body:    { comment: ReviewComment; accepted: boolean }
// Auth:    ?passphrase=... or x-tenure-passphrase header (LIVE only)
// Returns: FeedbackResponse
export async function POST(req: NextRequest) {
  if (!validPassphrase(extractPassphrase(req))) {
    return Response.json({ error: 'Valid LIVE_MODE_PASSPHRASE required' }, { status: 401 });
  }

  // Rate limit: 300 requests/day.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';
  const rl = await checkRateLimit(ip, 'feedback');
  if (!rl.configured) {
    return Response.json({ error: 'Live mode unavailable.' }, { status: 503 });
  }
  if (!rl.allowed) {
    return Response.json(
      { error: 'Live demo limit reached.' },
      { status: 429, headers: { 'X-RateLimit-Reset': String(rl.reset) } },
    );
  }

  const body     = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const comment  = body.comment as ReviewComment | undefined;
  const accepted = typeof body.accepted === 'boolean' ? body.accepted : null;

  if (!comment || typeof comment.text !== 'string' || !comment.text.trim()) {
    return Response.json({ error: 'Body must include comment.text' }, { status: 400 });
  }
  if (accepted === null) {
    return Response.json({ error: 'Body must include accepted (boolean)' }, { status: 400 });
  }

  const category     = comment.conventionId?.trim() || comment.tier;
  const worldContent = accepted ? `Team accepts: ${comment.text}` : `Team rejects: ${comment.text}`;
  const expContent   = accepted ? `My ${category} suggestion was accepted` : `My ${category} suggestion was overruled`;
  const sharedTags   = [
    `tier:${comment.tier}`,
    ...(comment.conventionId ? [`convention:${comment.conventionId}`] : []),
  ];

  const [worldRes, expRes] = await Promise.all([
    retainWorldFact(worldContent, {
      tags:  [...sharedTags, accepted ? 'convention:accepted' : 'convention:rejected'],
      async: true,
    }),
    retainExperienceFact(expContent, {
      tags:  [...sharedTags, accepted ? 'outcome:accepted' : 'outcome:rejected'],
      async: true,
    }),
  ]);

  // operation_id is null when the backend processed synchronously — no wait needed.
  const operationIds = [worldRes.operation_id, expRes.operation_id].filter(
    (id): id is string => typeof id === 'string',
  );

  let timedOut = false;
  if (operationIds.length > 0) {
    const waitResults = await Promise.all(operationIds.map((id) => waitForProcessing(id)));
    timedOut = waitResults.some((r) => r.timedOut);
  }

  if (timedOut) {
    const response: FeedbackResponse = { retained: true, pending: true, observation: null };
    return Response.json(response);
  }

  let observation: ObservationUpdate | null = null;
  try {
    const obsResults = await recall(comment.text, { types: ['observation'], budget: 'low' });
    const top = obsResults[0];
    if (top) {
      const raw = top as Record<string, unknown>;
      observation = {
        text:       top.text,
        proofCount: typeof raw.proof_count    === 'number' ? raw.proof_count    : 1,
        trend:      typeof raw.freshness_trend === 'string' ? raw.freshness_trend : 'stable',
      };
    }
  } catch {
    // Observation lookup is best-effort; a failure here must not fail the retain.
  }

  const response: FeedbackResponse = { retained: true, pending: false, observation };
  return Response.json(response);
}
