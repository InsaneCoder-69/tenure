// Maximum characters of diff sent to the model (~1 k tokens at ~4 chars/token).
const MAX_DIFF_CHARS = 4_000;
// How many conventions to include in the prompt (highest proofCount first).
const MAX_CONVENTIONS = 5;
// Output token cap.
const MAX_TOKENS = 800;

export interface ReviewConvention {
  conventionId: string;
  text: string;
  proofCount: number;
}

export interface LLMComment {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  conventionId: string | null;
}

export interface ReviewResult {
  comments: LLMComment[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  // process.env is read here, at call time — not at module load time.
  // Callers must load their .env/.env.local before invoking generateReview.
  const val = process.env[key];
  if (!val) throw new Error(`reviewer: ${key} is not set (load .env.local before calling generateReview)`);
  return val;
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function topConventions(conventions: ReviewConvention[]): ReviewConvention[] {
  return [...conventions]
    .sort((a, b) => b.proofCount - a.proofCount)
    .slice(0, MAX_CONVENTIONS);
}

function buildSystemPrompt(conventions: ReviewConvention[], rejectedConventions: string[]): string {
  const list = conventions.length > 0
    ? conventions.map((c) => `[${c.conventionId}] (trust: ${c.proofCount}) ${c.text}`).join('\n')
    : '(none — flag only clear bugs as novel issues)';

  const rejectedBlock = rejectedConventions.length > 0
    ? `\nNEVER FLAG THESE — the team has explicitly rejected them:\n` +
      rejectedConventions.map((t) => `- ${t}`).join('\n') + '\n'
    : '';

  return `You are a senior code reviewer. You are skeptical, literal, and direct.
Your job: review a diff against the team's established conventions below.
Do not invent rules the team has not established. Do not nag about things the team ignores.
${rejectedBlock}
CONVENTIONS (highest trust first):
${list}

SEVERITY GUIDE:
- "error"   → violation of a convention with 5+ proofs (must fix)
- "warning" → violation of a convention with 3–4 proofs (should fix)
- "info"    → violation of a low-trust convention (1–2 proofs) or a novel observation

RULES:
- Only flag lines visible in the diff.
- Match conventionId exactly to one of the IDs above, or set it to null for novel issues.
- One sentence per message. No preamble.
- If there are no issues, return {"comments":[]}.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation:
{"comments":[{"line":<n>,"severity":"error"|"warning"|"info","message":"<string>","conventionId":"<id>"|null}]}`;
}

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return diff.slice(0, MAX_DIFF_CHARS) + '\n[...diff truncated...]';
}

function parseResult(raw: string, validIds: Set<string>): ReviewResult {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`reviewer: model returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).comments)
  ) {
    throw new Error(`reviewer: unexpected response shape: ${cleaned.slice(0, 200)}`);
  }

  const raw_comments = (parsed as { comments: unknown[] }).comments;
  const comments: LLMComment[] = [];

  for (const item of raw_comments) {
    if (typeof item !== 'object' || item === null) continue;
    const c = item as Record<string, unknown>;

    const line = typeof c.line === 'number' ? Math.round(c.line) : null;
    const severity = ['error', 'warning', 'info'].includes(c.severity as string)
      ? (c.severity as LLMComment['severity'])
      : 'info';
    const message = typeof c.message === 'string' ? c.message.trim() : null;
    const rawId = typeof c.conventionId === 'string' ? c.conventionId : null;
    const conventionId = rawId !== null && validIds.has(rawId) ? rawId : null;

    if (line === null || !message) continue;
    comments.push({ line, severity, message, conventionId });
  }

  return { comments };
}

// ── public API ────────────────────────────────────────────────────────────────

export async function generateReview(
  diff: string,
  conventions: ReviewConvention[],
  rejectedConventions: string[] = [],
): Promise<ReviewResult> {
  const apiKey = requireEnv('OPENROUTER_API_KEY');
  const model = requireEnv('OPENROUTER_MODEL');

  const selected = topConventions(conventions);
  const validIds = new Set(selected.map((c) => c.conventionId));
  const systemPrompt = buildSystemPrompt(selected, rejectedConventions);
  const userContent = truncateDiff(diff);

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/tenure',
      'X-Title': 'Tenure Code Reviewer',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(
      `reviewer: OpenRouter returned ${response.status} ${response.statusText}: ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`reviewer: OpenRouter error: ${data.error.message ?? JSON.stringify(data.error)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('reviewer: empty content in OpenRouter response');
  }

  return parseResult(content, validIds);
}
