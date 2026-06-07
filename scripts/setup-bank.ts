/**
 * Creates and configures the Hindsight bank for Tenure code review.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/setup-bank.ts
 *   # If env vars are not already exported in the shell:
 *   npx tsx --env-file=.env scripts/setup-bank.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { HindsightClient, HindsightError } from '@vectorize-io/hindsight-client';

// ── inline .env loader ────────────────────────────────────────────────────────
// Reads .env from the project root; skips any key already set in the environment.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
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
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`Error: ${key} is not set.`);
    console.error('Tip: run with  npx tsx --env-file=.env scripts/setup-bank.ts');
    process.exit(1);
  }
  return val;
}

// ── desired bank state ────────────────────────────────────────────────────────

const REFLECT_MISSION =
  "You are a senior code reviewer for this specific team. You enforce the team's " +
  'established conventions, are precise and direct, and do not nag about things ' +
  'the team has chosen to ignore.';

const RETAIN_MISSION =
  'Extract team coding conventions and best practices as world facts. ' +
  'Extract code review outcomes — accepted, rejected, or escalated suggestions — as experience facts.';

const OBSERVATIONS_MISSION =
  'Identify recurring patterns across code review sessions: which conventions are ' +
  "consistently accepted or rejected, how the team's standards evolve over time, " +
  'and where trust should increase or decrease.';

interface DesiredDirective {
  name: string;
  content: string;
}

const DESIRED_DIRECTIVES: DesiredDirective[] = [
  {
    name: 'Cite Convention',
    content: 'Always cite the learned convention a comment is based on.',
  },
  {
    name: 'Respect Team Rejections',
    content: 'Never flag a convention the team has rejected.',
  },
  {
    name: 'Stay In Diff Scope',
    content:
      'Ground every comment in a specific line from the submitted diff. ' +
      'Do not comment on code that is not part of the change.',
  },
];

// ── main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const bankId = requireEnv('HINDSIGHT_BANK_ID');
  const client = new HindsightClient({
    baseUrl: requireEnv('HINDSIGHT_API_URL'),
    apiKey: requireEnv('HINDSIGHT_API_KEY'),
  });

  // ── step 1: create bank ───────────────────────────────────────────────────
  process.stdout.write(`[1/3] Creating bank "${bankId}" ... `);
  try {
    await client.createBank(bankId);
    console.log('created.');
  } catch (err) {
    if (err instanceof HindsightError && err.statusCode === 409) {
      console.log('already exists.');
    } else {
      throw err;
    }
  }

  // ── step 2: configure bank ────────────────────────────────────────────────
  process.stdout.write('[2/3] Configuring bank ... ');
  await client.updateBankConfig(bankId, {
    reflectMission: REFLECT_MISSION,
    retainMission: RETAIN_MISSION,
    observationsMission: OBSERVATIONS_MISSION,
    enableObservations: true,
    dispositionSkepticism: 4,
    dispositionLiteralism: 5,
    dispositionEmpathy: 2,
  });
  console.log('done.');

  // ── step 3: sync directives (idempotent by name) ──────────────────────────
  console.log('[3/3] Syncing directives ...');
  const { items: existing } = await client.listDirectives(bankId);

  for (const desired of DESIRED_DIRECTIVES) {
    const found = existing.find((d) => d.name === desired.name);

    if (!found) {
      await client.createDirective(bankId, desired.name, desired.content);
      console.log(`  [created] "${desired.name}"`);
    } else if (found.content !== desired.content) {
      await client.updateDirective(bankId, found.id, { content: desired.content });
      console.log(`  [updated] "${desired.name}"`);
    } else {
      console.log(`  [ok]      "${desired.name}"`);
    }
  }

  console.log('\nBank setup complete.');
  console.log(`  bank id : ${bankId}`);
  console.log(`  directives : ${DESIRED_DIRECTIVES.length}`);
}

main().catch((err) => {
  console.error('\nSetup failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
