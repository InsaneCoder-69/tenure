/**
 * Seed the Hindsight bank with a real learning loop and export demo fixture files.
 *
 * Run: npx tsx scripts/seed-and-export.ts
 *
 * Hero moments produced:
 *   (A) Self-suppression: no-inline-handlers gets 3 rejections → trend stale → no comment in session
 *   (B) Revision:         default-export-pages gets contradictions → trend weakening
 *   (C) Promotion:        hook-naming at 4 proofs/strengthening → lib/replay.ts patches to 5 → BLOCK in demo
 *
 * Exports to public/fixtures/:
 *   session.json       — static demo review session (5 comments; no-inline-handlers suppressed)
 *   memory.json        — team memory snapshot (conventions + observations + style guide)
 *   observations.json  — raw Hindsight observations
 *   styleguide.txt     — reflect() output (one rule per line)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  retainWorldFact,
  retainExperienceFact,
  recall,
  reflect,
  listObservations,
  waitForProcessing,
  type ObservationItem,
} from '../lib/hindsight';
import { computeTier } from '../lib/trust-tiers';
import type {
  Convention,
  Observation,
  TeamMemory,
  ReviewSession,
  FreshnessTrend,
  TrustTier,
} from '../types/index';

// ── inline .env loader ────────────────────────────────────────────────────────
// Loads .env.local first (highest priority), then .env fills in missing keys.
// Skips any key already set in the shell environment.
for (const envFile of ['.env.local', '.env']) {
  const envPath = join(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val = raw.replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function requireEnv(key: string): void {
  if (!process.env[key]) {
    console.error(`✗ ${key} is not set. Add it to .env.local and retry.`);
    process.exit(1);
  }
}

function parseTrend(raw: string | null | undefined): FreshnessTrend {
  if (raw === 'strengthening' || raw === 'stable' || raw === 'weakening' || raw === 'stale') return raw;
  return 'stable';
}

async function waitAll(ids: (string | null | undefined)[]): Promise<void> {
  const valid = ids.filter((id): id is string => typeof id === 'string');
  if (valid.length === 0) return;
  const results = await Promise.all(valid.map((id) => waitForProcessing(id)));
  const timedOut = results.filter((r) => r.timedOut).length;
  if (timedOut > 0) {
    console.warn(`  ⚠  ${timedOut}/${valid.length} operations timed out — proceeding with available data`);
  }
}

// ── convention definitions ────────────────────────────────────────────────────
// proofCount and trend are FALLBACK values used when Hindsight does not return
// observation data for a given convention id. Real values come from listObservations().

interface ConventionDef {
  id: string;
  text: string;
  category: string;
  proofCount: number;
  trend: FreshnessTrend;
}

const CONVENTION_DEFS: ConventionDef[] = [
  { id: 'no-any',                 text: "Never use `any` — always use concrete types or `unknown` with a type guard",                                       category: 'TypeScript',       proofCount: 6, trend: 'stable'        },
  { id: 'async-error-handling',   text: "All `async` functions must wrap `await` calls in try/catch; never let rejections propagate unhandled",            category: 'Error Handling',   proofCount: 5, trend: 'stable'        },
  { id: 'hook-naming',            text: "Custom hooks must start with the `use` prefix to satisfy React's Rules of Hooks",                                  category: 'React',            proofCount: 4, trend: 'strengthening' },
  { id: 'no-console',             text: "Remove all `console.log` / `console.error` before merging; use the `logger` utility instead",                    category: 'Code Quality',     proofCount: 4, trend: 'strengthening' },
  { id: 'props-interface-naming', text: "Component props interfaces must use the `Props` suffix (e.g. `ButtonProps`, not `IButton`)",                      category: 'TypeScript',       proofCount: 3, trend: 'strengthening' },
  { id: 'exhaustive-deps',        text: "`useEffect` dependency arrays must be exhaustive — do not suppress the exhaustive-deps ESLint rule",              category: 'React',            proofCount: 2, trend: 'stable'        },
  { id: 'default-export-pages',   text: "Only route page files should use `export default`; all other modules should use named exports",                   category: 'Module Structure', proofCount: 3, trend: 'weakening'     },
  { id: 'no-inline-handlers',     text: "Avoid inline arrow functions as JSX event handlers in render — extract them as named callbacks",                  category: 'Performance',      proofCount: 1, trend: 'stale'         },
];

// ── Phase 1: accepted world facts ─────────────────────────────────────────────
// Establishes the baseline proof counts for each convention.

const PHASE1_WORLD_FACTS: Record<string, string[]> = {
  'no-any': [
    "Team rule: never use TypeScript 'any' type; always declare concrete types or 'unknown' with runtime type guards",
    "Code review blocked: developer used 'any' as API response type — required explicit interface definition",
    "PR accepted: replaced 'as any' cast with proper User interface — reviewer approved the type safety improvement",
    "Team accepts: converted 'any[]' parameter to ReadonlyArray<UserRecord> — reviewer praised the explicit type",
    "Convention no-any enforced: banned 'any' in generic type parameter; required 'unknown' with assertion guard",
    "Convention no-any: use Record<string, unknown> instead of any for dynamic objects — applied in 3 PRs this sprint",
  ],
  'async-error-handling': [
    "Team rule: all async functions must wrap await calls in try/catch — unhandled rejections caused production outage Q3 2024",
    "Code review blocked: async function missing error handling — required explicit try/catch with typed catch parameter",
    "PR accepted: added try/catch around fetch call after team review — clean error boundary pattern confirmed",
    "Convention enforced: async/await without error boundary rejected; async-error-handling standard applied",
    "Team accepts: refactored fetchUser to wrap in try/catch with contextual error message — pattern approved",
  ],
  'hook-naming': [
    "Team rule: custom React hooks must start with 'use' prefix to satisfy React's Rules of Hooks linter",
    "Code review: getUser() internally used useState — renamed to useGetUser to comply with hook-naming convention",
    "PR accepted: renamed 'fetchProfile' to 'useFetchProfile' — fixes react-hooks/rules-of-hooks lint error",
    "Convention hook-naming: function 'profileData' using useState blocked until renamed to 'useProfileData'",
  ],
  'no-console': [
    "Team rule: remove all console.log/error/warn before merging; use the logger utility from @/lib/logger instead",
    "Code review: console.log debugging statement in PR — required logger.info() for structured output",
    "PR accepted: replaced console.error with logger.error — reviewer confirmed this is the standard practice",
    "Convention no-console: bare console statements rejected in 4 consecutive PRs — team discussed adding an ESLint rule",
  ],
  'props-interface-naming': [
    "Team rule: React component props interfaces must use 'Props' suffix — ButtonProps not IButton",
    "Code review: interface 'IUserCard' renamed to 'UserCardProps' — team prefers the Props suffix convention",
    "PR accepted: refactored all component prop interfaces to follow the Props suffix naming",
  ],
  'exhaustive-deps': [
    "Team rule: useEffect dependency arrays must be exhaustive — never suppress the react-hooks/exhaustive-deps ESLint rule",
    "Code review: eslint-disable comment for exhaustive-deps rejected — fix the actual dependency array instead",
  ],
  'default-export-pages': [
    "Team rule: only Next.js route page files should use export default; all other modules use named exports",
    "PR accepted: converted default export to named export in utility module — cleaner tree-shaking",
    "PR accepted: lib/helpers.ts changed from 'export default' to named exports — reviewer approved",
  ],
  'no-inline-handlers': [
    "Team suggestion: avoid inline arrow functions as JSX event handlers in render — extract as named callbacks for readability",
  ],
};

// ── Phase 2: rejections and contradictions ────────────────────────────────────
// Hero A — no-inline-handlers: 3 rejections → trend stale → self-suppression
// Hero B — default-export-pages: 2 contradictions → trend weakening → observation revision

interface RetainSpec {
  type: 'world' | 'experience';
  content: string;
  tags: string[];
}

const PHASE2_FACTS: RetainSpec[] = [
  // Hero A: no-inline-handlers 3 rejections
  {
    type: 'experience',
    content: "My no-inline-handlers suggestion was overruled — team preferred the concise inline syntax in this case",
    tags: ['convention:rejected', 'category:performance', 'convention:no-inline-handlers', 'outcome:rejected'],
  },
  {
    type: 'experience',
    content: "Team dismissed no-inline-handlers: inline callback accepted in simple list render — not worth extracting",
    tags: ['convention:rejected', 'category:performance', 'convention:no-inline-handlers', 'outcome:rejected'],
  },
  {
    type: 'experience',
    content: "Reviewer closed no-inline-handlers comment: 'fine for small components, over-engineering is worse than inline functions'",
    tags: ['convention:rejected', 'category:performance', 'convention:no-inline-handlers', 'outcome:rejected'],
  },
  // Hero B: default-export-pages contradictions
  {
    type: 'world',
    content: "Exception approved: library file uses export default for better DX with dynamic imports — team agreed the rule has edge cases",
    tags: ['convention:rejected', 'category:modules', 'convention:default-export-pages'],
  },
  {
    type: 'world',
    content: "Mixed signals on default-export-pages: two senior engineers prefer default exports for cleaner consumer import syntax — convention under debate",
    tags: ['convention:rejected', 'category:modules', 'convention:default-export-pages'],
  },
  // Accepted experience facts for strong conventions
  {
    type: 'experience',
    content: "My no-any comment was accepted — TypeScript strictness is a first-class quality gate on this team",
    tags: ['convention:accepted', 'category:typescript', 'convention:no-any', 'outcome:accepted'],
  },
  {
    type: 'experience',
    content: "My async-error-handling comment was accepted — post-incident hardening means this convention is non-negotiable",
    tags: ['convention:accepted', 'category:async', 'convention:async-error-handling', 'outcome:accepted'],
  },
  {
    type: 'experience',
    content: "My hook-naming suggestion was accepted — team is strict about React Rules of Hooks compliance",
    tags: ['convention:accepted', 'category:react', 'convention:hook-naming', 'outcome:accepted'],
  },
  {
    type: 'experience',
    content: "My no-console suggestion was accepted — structured logging is expected before merge",
    tags: ['convention:accepted', 'category:logging', 'convention:no-console', 'outcome:accepted'],
  },
];

// ── static demo session ───────────────────────────────────────────────────────
// This is the REPLAY mode entry point — a real PR diff with five comments.
// Note: there is NO comment for no-inline-handlers (line 14 has an inline handler)
// because Hero A causes Tenure to self-suppress that convention.

const DEMO_SESSION: ReviewSession = {
  id: 'session-demo-001',
  filePath: 'src/hooks/userProfile.ts',
  diff: [
    { type: 'header',  lineNo: null, oldLineNo: null, content: '@@ -1,12 +1,21 @@'                                                  },
    { type: 'removed', lineNo: null, oldLineNo: 1,    content: "import { useState } from 'react'"                                  },
    { type: 'added',   lineNo: 1,    oldLineNo: null, content: "import { useState, useEffect } from 'react'"                       },
    { type: 'context', lineNo: 2,    oldLineNo: 2,    content: ''                                                                   },
    { type: 'removed', lineNo: null, oldLineNo: 3,    content: 'async function fetchUserData(id: string): Promise<User> {'         },
    { type: 'removed', lineNo: null, oldLineNo: 4,    content: '  try {'                                                            },
    { type: 'removed', lineNo: null, oldLineNo: 5,    content: '    const res = await fetch(`/api/users/${id}`)'                   },
    { type: 'removed', lineNo: null, oldLineNo: 6,    content: '    if (!res.ok) throw new Error(res.statusText)'                  },
    { type: 'removed', lineNo: null, oldLineNo: 7,    content: '    return res.json() as Promise<User>'                            },
    { type: 'removed', lineNo: null, oldLineNo: 8,    content: '  } catch (e) {'                                                   },
    { type: 'removed', lineNo: null, oldLineNo: 9,    content: '    throw new Error(`Failed to load user ${id}: ${e}`)'            },
    { type: 'removed', lineNo: null, oldLineNo: 10,   content: '  }'                                                               },
    { type: 'added',   lineNo: 3,    oldLineNo: null, content: 'async function loadUser(id: string) {'                             },
    { type: 'added',   lineNo: 4,    oldLineNo: null, content: '  const res = await fetch(`/api/users/${id}`)'                     },
    { type: 'added',   lineNo: 5,    oldLineNo: null, content: '  return res.json() as any'                                        },
    { type: 'context', lineNo: 6,    oldLineNo: 11,   content: '}'                                                                 },
    { type: 'context', lineNo: 7,    oldLineNo: 12,   content: ''                                                                  },
    { type: 'removed', lineNo: null, oldLineNo: 13,   content: 'export function useUserProfile(userId: string) {'                  },
    { type: 'added',   lineNo: 8,    oldLineNo: null, content: 'export function userProfile(userId: string) {'                     },
    { type: 'added',   lineNo: 9,    oldLineNo: null, content: '  const [data, setData] = useState<any>(null)'                    },
    { type: 'context', lineNo: 10,   oldLineNo: 14,   content: '  const [loading, setLoading] = useState(true)'                   },
    { type: 'context', lineNo: 11,   oldLineNo: 15,   content: ''                                                                  },
    { type: 'context', lineNo: 12,   oldLineNo: 16,   content: '  useEffect(() => {'                                               },
    { type: 'added',   lineNo: 13,   oldLineNo: null, content: "    console.log('Loading user:', userId)"                          },
    { type: 'added',   lineNo: 14,   oldLineNo: null, content: '    loadUser(userId).then(d => { setData(d); setLoading(false) })' },
    { type: 'removed', lineNo: null, oldLineNo: 17,   content: '    fetchUserData(userId)'                                         },
    { type: 'removed', lineNo: null, oldLineNo: 18,   content: '      .then(d => { setData(d); setLoading(false) })'               },
    { type: 'removed', lineNo: null, oldLineNo: 19,   content: '      .catch(console.error)'                                       },
    { type: 'context', lineNo: 15,   oldLineNo: 20,   content: '  }, [])'                                                          },
    { type: 'context', lineNo: 16,   oldLineNo: 21,   content: ''                                                                  },
    { type: 'context', lineNo: 17,   oldLineNo: 22,   content: '  return { data, loading }'                                        },
    { type: 'context', lineNo: 18,   oldLineNo: 23,   content: '}'                                                                 },
  ],
  comments: [
    {
      id: 'cmt-1',
      lineNo: 4,
      text: 'Async functions must wrap `await` calls in try/catch. Unhandled promise rejections will crash the process in Node and silently swallow errors in the browser.',
      conventionId: 'async-error-handling',
      tier: 'block',
      rationale: '5 observations, stable — introduced after a Q3 2024 outage caused by an unhandled rejection in the auth service',
    },
    {
      id: 'cmt-2',
      lineNo: 5,
      text: 'Avoid `any` — use the concrete `User` type from `@/types`. The `any` annotation defeats type-checking for all downstream callers.',
      conventionId: 'no-any',
      tier: 'block',
      rationale: '6 observations, stable — zero-tolerance across the codebase since TypeScript strict mode was enabled',
    },
    {
      id: 'cmt-3',
      lineNo: 8,
      text: "Custom hooks must start with `use`. React's linter rules and the runtime Rules of Hooks both depend on this prefix to identify hooks correctly.",
      conventionId: 'hook-naming',
      tier: 'warn',
      rationale: '4 observations, strengthening — flagged in 4 of the last 6 PRs touching the hooks directory',
    },
    {
      id: 'cmt-4',
      lineNo: 9,
      text: 'Same as line 5 — `useState<any>` is an `any` annotation. Replace with `useState<User | null>`.',
      conventionId: 'no-any',
      tier: 'block',
      rationale: '6 observations, stable',
    },
    {
      id: 'cmt-5',
      lineNo: 13,
      text: "`console.log` must be removed before merging. Use the `logger` utility (`import { logger } from '@/lib/logger'`) for structured output.",
      conventionId: 'no-console',
      tier: 'warn',
      rationale: '4 observations, strengthening — appears in nearly every PR review; consider adding an ESLint rule',
    },
  ],
};

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  requireEnv('HINDSIGHT_API_URL');
  requireEnv('HINDSIGHT_API_KEY');
  requireEnv('HINDSIGHT_BANK_ID');

  const outDir = join(process.cwd(), 'public', 'fixtures');
  mkdirSync(outDir, { recursive: true });

  // ── Phase 1: accepted world facts ─────────────────────────────────────────
  console.log('\n[1/5] Retaining accepted world facts ...');
  const phase1Specs = Object.entries(PHASE1_WORLD_FACTS).flatMap(([convId, facts]) =>
    facts.map((content) => ({ convId, content })),
  );

  const phase1Ops = await Promise.all(
    phase1Specs.map(({ convId, content }) =>
      retainWorldFact(content, {
        tags: ['convention:accepted', `convention:${convId}`],
        async: true,
      }).then((r) => {
        process.stdout.write('.');
        return r.operation_id;
      }),
    ),
  );
  console.log(`  ${phase1Ops.length} retains queued`);

  console.log('  Waiting for Phase 1 to settle ...');
  await waitAll(phase1Ops);
  console.log('  Phase 1 done.');

  // ── Phase 2: rejections / contradictions ──────────────────────────────────
  console.log('\n[2/5] Retaining rejection and contradiction facts ...');
  const phase2Ops = await Promise.all(
    PHASE2_FACTS.map((spec) => {
      const fn = spec.type === 'world' ? retainWorldFact : retainExperienceFact;
      return fn(spec.content, { tags: spec.tags, async: true }).then((r) => {
        process.stdout.write('.');
        return r.operation_id;
      });
    }),
  );
  console.log(`  ${phase2Ops.length} retains queued`);

  console.log('  Waiting for Phase 2 to settle ...');
  await waitAll(phase2Ops);
  console.log('  Phase 2 done.');

  // ── Phase 3: recall spot-check ────────────────────────────────────────────
  console.log('\n[3/5] Recall spot-check ...');
  try {
    const results = await recall('TypeScript any type annotation', {
      types: ['world'],
      budget: 'low',
    });
    console.log(`  ${results.length} results recalled for 'TypeScript any type annotation'`);
  } catch (err) {
    console.warn(`  Recall spot-check failed (non-fatal): ${String(err)}`);
  }

  // ── Phase 4: observations + reflect ──────────────────────────────────────
  console.log('\n[4/5] Fetching observations and running reflect() ...');
  const [observations, reflectResult] = await Promise.all([
    listObservations({ limit: 100 }),
    reflect(
      "Summarize this team's coding conventions as a short bullet-point style guide. " +
        'Maximum 8 rules, one sentence each. ' +
        'Focus on conventions with the strongest consensus and most proof. ' +
        'Use plain language — no preamble, no section headers, just the rules.',
      { budget: 'low' },
    ),
  ]);
  console.log(`  ${observations.length} observations retrieved`);
  console.log(`  Style guide preview: ${reflectResult.text.slice(0, 80).replace(/\n/g, ' ')}…`);

  // ── Phase 5: build and write fixtures ─────────────────────────────────────
  console.log('\n[5/5] Writing fixture files ...');

  // Build an observation lookup by id and document_id.
  const obsById = new Map<string, ObservationItem>();
  for (const obs of observations) {
    obsById.set(obs.id, obs);
    if (obs.document_id) obsById.set(obs.document_id, obs);
  }

  // Conventions: CONVENTION_DEFS shape, overlaid with real Hindsight proof counts / trends.
  const conventions: Convention[] = CONVENTION_DEFS.map((def): Convention => {
    const obs        = obsById.get(def.id);
    const proofCount = obs?.proof_count ?? def.proofCount;
    const trend      = obs?.freshness_trend ? parseTrend(obs.freshness_trend) : def.trend;
    const tier       = computeTier(proofCount, trend) as TrustTier;
    return { id: def.id, text: def.text, tier, proofCount, trend, category: def.category };
  }).sort((a, b) => {
    const order: Record<TrustTier, number> = { block: 0, warn: 1, suggest: 2 };
    const d = order[a.tier] - order[b.tier];
    return d !== 0 ? d : b.proofCount - a.proofCount;
  });

  // Style guide: strip bullet markers, filter blanks, cap at 8 rules.
  const styleGuideLines = reflectResult.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter((l) => l.length > 10)
    .slice(0, 8);

  // Observations: real Hindsight snapshot.
  const observationItems: Observation[] = observations
    .filter((obs) => obs.text.trim().length > 0)
    .map((obs): Observation => ({
      id:         obs.id,
      text:       obs.text,
      type:       'observation',
      proofCount: obs.proof_count  ?? undefined,
      trend:      obs.freshness_trend ? parseTrend(obs.freshness_trend) : undefined,
    }));

  const memory: TeamMemory = {
    conventions,
    observations: observationItems,
    styleGuide: styleGuideLines,
    lastUpdated: new Date().toISOString(),
  };

  writeFileSync(join(outDir, 'session.json'),      JSON.stringify(DEMO_SESSION,    null, 2));
  console.log('  ✓ session.json');

  writeFileSync(join(outDir, 'memory.json'),       JSON.stringify(memory,          null, 2));
  console.log('  ✓ memory.json');

  writeFileSync(join(outDir, 'observations.json'), JSON.stringify(observationItems, null, 2));
  console.log('  ✓ observations.json');

  writeFileSync(join(outDir, 'styleguide.txt'),    styleGuideLines.join('\n') + '\n');
  console.log('  ✓ styleguide.txt');

  console.log('\n✓ Seeding complete.');
  console.log(`  Conventions : ${conventions.length}`);
  console.log(`  Observations: ${observationItems.length}`);
  console.log(`  Style rules : ${styleGuideLines.length}`);
  console.log('\nHero moments seeded:');
  console.log('  (A) no-inline-handlers — 1 accept + 3 rejects → self-suppression (no cmt-6 in session)');
  console.log('  (B) default-export-pages — 3 accepts + 2 contradictions → trend weakening');
  console.log('  (C) hook-naming — 4 proofs, strengthening → lib/replay.ts step 7 patches to BLOCK');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
