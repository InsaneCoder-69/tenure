// POST /api/unlock
// Body: { passphrase: string }
// Returns: { valid: boolean }
// Used by the client to pre-validate before navigating to ?passphrase=...
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { passphrase } = body as { passphrase?: string };
  const valid =
    typeof passphrase === 'string' &&
    !!process.env.LIVE_MODE_PASSPHRASE &&
    passphrase === process.env.LIVE_MODE_PASSPHRASE;
  return Response.json({ valid });
}
