# Tenure

> **Other agents remember. Tenure earns trust.**

---

## What it does

Tenure is an AI code reviewer that learns your team's conventions from real feedback and enforces only what your team has actually validated. Paste a diff — it queries its memory for conventions your team has accepted, filters out ones you've rejected, and returns inline comments with a trust tier on each one. Accept a comment and that rule gets stronger. Reject it and Tenure backs off. Over time the memory compounds: suggestions graduate to warnings, warnings graduate to blocks, and the reviewer gets more precise with every review your team runs.

---

## Live Demo & Source

| | |
|---|---|
| **Live demo** | [https://tenure-green.vercel.app](https://tenure-green.vercel.app) |
| **GitHub** | [https://github.com/vatsaltrivedi/tenure](https://github.com/vatsaltrivedi/tenure) |

---

## Features

- **Inline diff comments** — every comment is anchored to a specific line number in the diff
- **Trust-tier badges** — each comment is labelled SUGGEST, WARN, or BLOCK based on how much evidence backs it
- **Convention citations** — comments show exactly which team convention they enforce, with the convention text quoted
- **Rejection memory** — conventions your team has explicitly rejected are permanently suppressed from future reviews
- **Flexible diff input** — accepts plain code, partial `+/-` diffs, or full unified diffs with `@@` headers; auto-normalised
- **Team Memory panel** — live view of all learned conventions grouped by tier with proof counts and freshness trends
- **Self-written Style Guide** — Tenure synthesises a plain-English bullet-point guide from its own memory, regenerated on each fetch
- **Tier-change callouts** — animated promotion and demotion cards appear in real time when feedback shifts a convention's tier
- **Impact Dashboard** — persistent stats bar: total reviews, conventions by tier, issues caught by severity, acceptance rate, Team Health Score 0–100
- **Review caching** — identical diffs return cached results within one hour; cache is keyed by SHA-256 of the diff
- **Rate limiting** — sliding 24-hour windows per route so the demo stays available

---

## How it works

### The review loop

1. A diff is submitted to `/api/review`
2. Tenure runs two parallel Hindsight recalls against the diff:
   - `world` facts tagged `convention:accepted` → conventions to enforce
   - `experience` facts tagged `convention:rejected` → conventions to suppress
3. The top 5 conventions by proof count are injected into a system prompt alongside the severity guide
4. The LLM (via OpenRouter) returns a JSON array of comments; each comment references a convention ID or is marked as a novel observation
5. Each comment is assigned a trust tier using `computeTier(proofCount, trend)` and returned to the client

### Trust tiers

| Tier | Colour | Condition | Effect |
|---|---|---|---|
| SUGGEST | sky | 1–2 proofs | Mentioned softly |
| WARN | amber | 3–4 proofs, strengthening | Flagged on every PR |
| BLOCK | rose | 5+ proofs, stable or strengthening | Gates all merges |

Tiers demote automatically. A convention with a weakening or stale freshness trend drops one tier regardless of proof count. Trust is never locked in.

### World facts and Experience facts

Every accept or reject writes two facts into Hindsight:

**World fact** — the objective team decision:
```
"Team accepts: Never use inline event handlers — extract to named functions."
tags: ["tier:block", "convention:<id>", "convention:accepted"]
```

**Experience fact** — the reviewer's first-person outcome:
```
"My block suggestion was accepted"
tags: ["tier:block", "convention:<id>", "outcome:accepted"]
```

Hindsight distills these into **observations** over time. Each observation carries a `proof_count` (how many supporting facts back it) and a `freshness_trend` (whether recent evidence is growing or fading). Those two fields drive the tier computation on every subsequent review.

### Team Health Score

```
convScore  = (block×3 + warn×2 + suggest×1) / (total×3)
acceptRate = accepted / (accepted + rejected)
health     = round(min(convScore × 100, 100) × (0.4 + acceptRate × 0.6))
```

Ranges 0–100. Acceptance rate is weighted at 60% — the team's trust in Tenure matters as much as the tier distribution.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, Server + Client Components |
| Language | TypeScript 5 (strict) |
| UI | React 19 · Tailwind CSS v4 |
| Memory engine | Hindsight Cloud (`@vectorize-io/hindsight-client` v0.7.2) |
| LLM gateway | OpenRouter — model is an env var, swap without code changes |
| Cache · rate limit · stats | Upstash Redis (`@upstash/redis` · `@upstash/ratelimit`) |
| Deployment | Vercel |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/vatsaltrivedi/tenure
cd tenure
npm install
```

### 2. Set environment variables

Create `.env.local` in the project root:

```env
# LLM — OpenRouter
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=anthropic/claude-3.5-haiku   # any OpenRouter model ID

# Memory — Hindsight Cloud
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_key
HINDSIGHT_BANK_ID=your_bank_id

# Cache, rate limiting, stats — Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 3. Create the Hindsight memory bank

```bash
npx tsx scripts/setup-bank.ts
```

Creates a bank configured with review-tuned missions and dispositions: skepticism 4/5, literalism 5/5, empathy 1/5.

### 4. Seed initial memory

```bash
npx tsx scripts/seed-and-export.ts
```

Runs 37 retain operations across three learning scenarios (self-suppression, observation revision, tier promotion), producing real conventions and exporting fixture files to `public/fixtures/`. Skip this if you want to start from a blank memory and let the team build it organically.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paste a diff, read the comments, accept or reject — the memory updates in real time.

---

## API

All routes require Upstash to be configured. Unconfigured → `503`. Rate exceeded → `429` with `X-RateLimit-Reset` header.

---

### `POST /api/review`

Run a live review of a diff against team memory.

**Rate limit:** 100 requests / 24 h

**Request**
```json
{
  "diff":     "string",   // unified diff, partial diff, or plain code — auto-normalised
  "filePath": "string"    // optional, used for display only
}
```

**Response `200`**
```json
{
  "id": "live-abc123def456",
  "filePath": "src/components/Button.tsx",
  "diff": [],
  "comments": [
    {
      "id": "cmt-abc123-0",
      "lineNo": 12,
      "text": "Inline handler — extract to a named function.",
      "conventionId": "obs-uuid",
      "tier": "block",
      "rationale": "Enforces established convention (block)"
    }
  ]
}
```

**Response `400`** — missing or empty diff  
**Response `500`** — `{ "error": "<actual error message>" }`

---

### `POST /api/feedback`

Record an accept or reject for a review comment. Writes a world fact and an experience fact into Hindsight, then returns the updated observation for that convention.

**Rate limit:** 300 requests / 24 h

**Request**
```json
{
  "comment": {
    "id": "cmt-abc123-0",
    "lineNo": 12,
    "text": "Inline handler — extract to a named function.",
    "conventionId": "obs-uuid",
    "tier": "block",
    "rationale": "Enforces established convention (block)"
  },
  "accepted": true
}
```

**Response `200`**
```json
{
  "retained": true,
  "pending": false,
  "observation": {
    "text": "Team consistently accepts inline-handler suggestions.",
    "proofCount": 8,
    "trend": "strengthening"
  }
}
```

`pending: true` means the Hindsight async operation is still in flight (timed out at 20 s); the retain succeeded.  
`observation: null` when no matching observation was found post-retain.

---

### `GET /api/memory`

Fetch the current team memory: conventions with tiers and trends, raw observations, and the self-written style guide.

**Rate limit:** 30 requests / 24 h

**Response `200`**
```json
{
  "conventions": [
    {
      "id": "obs-uuid",
      "text": "Never use inline event handlers in JSX.",
      "tier": "block",
      "proofCount": 7,
      "trend": "strengthening",
      "category": "react"
    }
  ],
  "observations": [
    {
      "id": "obs-uuid-2",
      "text": "Team consistently rejects suggestions about console.log removal.",
      "type": "observation",
      "proofCount": 3,
      "trend": "stable"
    }
  ],
  "styleGuide": [
    "Always use explicit return types on exported functions.",
    "Prefer named exports over default exports in utility modules."
  ],
  "lastUpdated": "2026-06-07T10:00:00.000Z"
}
```

---

### `GET /api/stats`

Fetch all Impact Dashboard counters.

**Response `200`**
```json
{
  "reviews": 42,
  "issues": {
    "total": 187,
    "block": 34,
    "warn": 89,
    "suggest": 64
  },
  "feedback": {
    "accepted": 131,
    "rejected": 28
  }
}
```

**Response `503`** — Upstash not configured  
**Response `500`** — Redis read failed

---

## Screenshots

Screenshots live in `/screenshots`. Add images there and they will render here.

![Impact Dashboard](screenshots/impact-dashboard.png)
*Impact Dashboard — total reviews, conventions by tier, issues caught, acceptance rate, Team Health Score*

![Diff panel with inline comments](screenshots/diff-panel.png)
*Inline comments anchored to line numbers with BLOCK / WARN / SUGGEST tier badges*

![Team Memory panel](screenshots/memory-panel.png)
*Team Memory — conventions grouped by tier with proof counts, trend arrows, and tier-change callouts*

![Self-written Style Guide](screenshots/style-guide.png)
*Style Guide synthesised by Tenure from its own memory*

---

## License

MIT
