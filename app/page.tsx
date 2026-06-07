import type { AppMode } from '@/types';
import { getFixtureSession, getFixtureMemory } from '@/lib/fixtures';
import { isUpstashConfigured } from '@/lib/rate-limit';
import TenureApp from '@/components/TenureApp';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ passphrase?: string }>;
}) {
  const { passphrase } = await searchParams;

  // LIVE mode requires both a valid passphrase AND Upstash configured.
  // Without Upstash we cannot enforce rate limits, so LIVE is disabled and the
  // app falls back to REPLAY — no secrets ever reach the client.
  const mode: AppMode =
    isUpstashConfigured() &&
    !!process.env.LIVE_MODE_PASSPHRASE &&
    passphrase === process.env.LIVE_MODE_PASSPHRASE
      ? 'live'
      : 'replay';

  const session = getFixtureSession();
  const memory = getFixtureMemory();

  return <TenureApp mode={mode} session={session} memory={memory} />;
}
