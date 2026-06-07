/**
 * Quick smoke test for generateReview.
 * Makes a real OpenRouter call — requires OPENROUTER_API_KEY in .env.local.
 *
 * Usage:
 *   npx tsx scripts/test-reviewer.ts
 */

// Static imports are hoisted by the module system, so dotenv.config() must run
// before any module that reads process.env is imported. We use a dynamic import
// for generateReview so it is resolved after the env is populated.
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Fallback so the test works even if OPENROUTER_MODEL is absent from .env.local.
process.env.OPENROUTER_MODEL ??= 'qwen/qwen3-coder:free';

const SAMPLE_DIFF = `
@@ -1,10 +1,15 @@
 import React from 'react';
+import { useState } from 'react';

-export default function UserCard({ user }: { user: any }) {
+export default function UserCard({ user }: { user: { name: string; age: number } }) {
+  const [open, setOpen] = useState(false);
+
   return (
-    <div onClick={() => console.log(user)}>
-      {user.name}
+    <div onClick={() => { console.log(user); setOpen(!open); }}>
+      {user.name} ({user.age})
     </div>
   );
 }
`.trim();

async function main() {
  // Dynamic import: resolved here, after dotenv.config() and the env fallback above.
  const { generateReview } = await import('../lib/reviewer');

  console.log('Calling generateReview with sample diff and empty conventions...\n');
  console.log('Diff:\n' + SAMPLE_DIFF + '\n');
  console.log('Model:', process.env.OPENROUTER_MODEL);

  const result = await generateReview(SAMPLE_DIFF, []);

  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n${result.comments.length} comment(s) returned.`);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
