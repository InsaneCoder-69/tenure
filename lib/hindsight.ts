import {
  HindsightClient,
  createClient,
  sdk,
  type RecallResult,
  type RetainResponse,
  type ReflectResponse,
} from '@vectorize-io/hindsight-client';

const POLL_INTERVAL_MS = 1_000;
const HARD_TIMEOUT_MS = 20_000;

// ── private helpers ──────────────────────────────────────────────────────────

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Hindsight: ${key} is not set`);
  return val;
}

let _client: HindsightClient | null = null;

function getClient(): HindsightClient {
  if (!_client) {
    _client = new HindsightClient({
      baseUrl: env('HINDSIGHT_API_URL'),
      apiKey: env('HINDSIGHT_API_KEY'),
    });
  }
  return _client;
}

function bankId(): string {
  return env('HINDSIGHT_BANK_ID');
}

// ── exported types ───────────────────────────────────────────────────────────

export type { RecallResult, RetainResponse, ReflectResponse };

export interface ObservationItem {
  id: string;
  text: string;
  type: string;
  context: string | null;
  tags: string[];
  document_id: string | null;
  // These fields are present when Hindsight stores them; undefined otherwise.
  proof_count: number | null;
  freshness_trend: string | null;
}

export interface WaitResult {
  completed: boolean;
  timedOut: boolean;
  status: string;
}

// ── public API ───────────────────────────────────────────────────────────────

export async function retainWorldFact(
  content: string,
  opts: {
    documentId?: string;
    context?: string;
    tags?: string[];
    async?: boolean;
  } = {},
): Promise<RetainResponse> {
  try {
    return await getClient().retain(bankId(), content, {
      context: opts.context ?? 'team convention / world fact',
      documentId: opts.documentId,
      tags: opts.tags,
      async: opts.async,
    });
  } catch (err) {
    throw new Error(`Hindsight retainWorldFact failed: ${String(err)}`);
  }
}

export async function retainExperienceFact(
  content: string,
  opts: {
    documentId?: string;
    context?: string;
    tags?: string[];
    async?: boolean;
  } = {},
): Promise<RetainResponse> {
  try {
    return await getClient().retain(bankId(), content, {
      context: opts.context ?? 'code review outcome / experience',
      documentId: opts.documentId,
      tags: opts.tags,
      async: opts.async,
    });
  } catch (err) {
    throw new Error(`Hindsight retainExperienceFact failed: ${String(err)}`);
  }
}

export async function recall(
  query: string,
  opts: {
    types?: Array<'world' | 'experience' | 'observation'>;
    budget?: 'low' | 'mid' | 'high';
    maxTokens?: number;
    tags?: string[];
    tagsMatch?: 'any' | 'all' | 'any_strict' | 'all_strict';
  } = {},
): Promise<RecallResult[]> {
  try {
    const res = await getClient().recall(bankId(), query, {
      types: opts.types,
      budget: opts.budget,
      maxTokens: opts.maxTokens,
      tags: opts.tags,
      tagsMatch: opts.tagsMatch,
    });
    return res.results ?? [];
  } catch (err) {
    throw new Error(`Hindsight recall failed: ${String(err)}`);
  }
}

export async function reflect(
  query: string,
  opts: {
    budget?: 'low' | 'mid' | 'high';
    context?: string;
    factTypes?: Array<'world' | 'experience' | 'observation'>;
  } = {},
): Promise<{ text: string }> {
  try {
    const res = await getClient().reflect(bankId(), query, {
      budget: opts.budget,
      context: opts.context,
      factTypes: opts.factTypes,
    });
    return { text: res.text };
  } catch (err) {
    throw new Error(`Hindsight reflect failed: ${String(err)}`);
  }
}

export async function listObservations(
  opts: { limit?: number; offset?: number } = {},
): Promise<ObservationItem[]> {
  try {
    const res = await getClient().listMemories(bankId(), {
      type: 'observation',
      limit: opts.limit,
      offset: opts.offset,
    });
    return (res.items ?? []).map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        id: String(raw.id ?? ''),
        text: String(raw.text ?? raw.content ?? ''),
        type: String(raw.type ?? 'observation'),
        context: raw.context != null ? String(raw.context) : null,
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        document_id: raw.document_id != null ? String(raw.document_id) : null,
        proof_count: typeof raw.proof_count === 'number' ? raw.proof_count : null,
        freshness_trend: typeof raw.freshness_trend === 'string' ? raw.freshness_trend : null,
      };
    });
  } catch (err) {
    throw new Error(`Hindsight listObservations failed: ${String(err)}`);
  }
}

export async function createOrGetBank(): Promise<void> {
  try {
    const client = getClient();
    const id = bankId();

    await client.createBank(id, {
      retainMission:
        'Extract team coding conventions, preferences, and best practices as world facts. ' +
        'Extract code review outcomes (accepted, rejected, or escalated suggestions) as experience facts.',
      reflectMission:
        'You are a code review assistant that synthesizes team standards and past review outcomes ' +
        'into actionable, trust-calibrated feedback.',
      observationsMission:
        'Identify recurring patterns across code review sessions: which conventions are consistently ' +
        'accepted or rejected, how the team’s standards evolve, and where trust should increase or decrease.',
      enableObservations: true,
    });

    await client.updateBankConfig(id, {
      dispositionSkepticism: 4,
      dispositionLiteralism: 5,
      dispositionEmpathy: 1,
    });
  } catch (err) {
    throw new Error(`Hindsight createOrGetBank failed: ${String(err)}`);
  }
}

export async function waitForProcessing(
  operationId: string,
  timeoutMs = HARD_TIMEOUT_MS,
): Promise<WaitResult> {
  const bid = bankId();
  const apiKey = env('HINDSIGHT_API_KEY');
  const rawClient = createClient({ baseUrl: env('HINDSIGHT_API_URL') });
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'unknown';

  try {
    while (Date.now() < deadline) {
      const { data, error } = await sdk.getOperationStatus({
        client: rawClient,
        path: { bank_id: bid, operation_id: operationId },
        headers: { authorization: `Bearer ${apiKey}` },
      });

      if (error) throw error;

      lastStatus = data?.status ?? 'unknown';

      if (['completed', 'failed', 'cancelled'].includes(lastStatus)) {
        return { completed: lastStatus === 'completed', timedOut: false, status: lastStatus };
      }

      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    return { completed: false, timedOut: true, status: lastStatus };
  } catch (err) {
    throw new Error(`Hindsight waitForProcessing failed: ${String(err)}`);
  }
}
