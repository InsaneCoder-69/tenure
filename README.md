# Tenure

**AI code reviewer that earns trust over time.**

Tenure learns your team's coding conventions from real review feedback, tracks how confident it is in each rule, and enforces only what your team has actually validated — getting sharper with every accept and reject.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-tenure--green.vercel.app-orange?style=flat-square)](https://tenure-green.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-vatsaltrivedi%2Ftenure-181717?style=flat-square&logo=github)](https://github.com/vatsaltrivedi/tenure)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

---

## Live Demo

**[https://tenure-green.vercel.app](https://tenure-green.vercel.app)**

Paste any code or diff and see a live review grounded in the team's accumulated memory. Accept or reject comments to train the system in real time.

---

## Features

### Core Review Engine
- **Inline diff comments** anchored to exact line numbers with trust-tier badges (BLOCK / WARN / SUGGEST)
- **Convention-grounded feedback** — every comment cites the specific team convention it enforces, not a generic rule
- **Rejected-convention suppression** — comments the team has explicitly rejected are permanently filtered out
- **Flexible diff input** — accepts plain code, partial `+/-` diffs, or full unified diffs with `@@` headers; auto-detected and normalized

### Trust Tier System
- **SUGGEST** (sky) — 1–2 proofs; Tenure is watching, mentions it softly
- **WARN** (amber) — 3–4 proofs, strengthening trend; flags on every PR
- **BLOCK** (rose) — 5+ proofs, stable/strengthening; gates all merges
- **Automatic demotion** — weakening or stale conventions drop a tier; trust is never assumed
- **Live tier-change callouts** — animated promotion/demotion cards appear in real time when feedback shifts a convention's tier

### Team Memory Panel
- **Conventions by tier** — full list grouped BLOCK → WARN → SUGGEST, sorted by proof count
- **Observations** — Hindsight's distilled cross-session patterns not yet promoted to full conventions
- **Self-written Style Guide** — Tenure synthesises its own bullet-point style guide from everything it has learned; regenerated on each memory fetch

### Impact Dashboard
- **Total reviews** run since deployment
- **Conventions learned** with live tier breakdown (N block / N warn / N suggest)
- **Issues caught** total and by severity tier
- **Acceptance rate** — percentage of Tenure's suggestions the team has accepted
- **Team Health Score** 0–100 — tier-weighted conventions × acceptance rate, colour-coded green/amber/red

### Infrastructure
- **Review caching** — identical diffs return cached results within 1 hour (SHA-256 keyed, stored in Redis)
- **Style guide caching** — 5-minute Redis cache on `reflect()` output to avoid redundant LLM calls
- **Rate limiting** — sliding 24-hour windows per route (review: 100/day, feedback: 300/day, memory: 30/day)
- **Real error surfacing** — no silent fixture fallback; API failures show the actual error with HTTP status

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Memory engine | Hindsight Cloud (`@vectorize-io/hindsight-client` v0.7.2) |
| LLM gateway | OpenRouter (model-agnostic; swap without code changes) |
| Cache / rate limit | Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`) |
| Deployment | Vercel |

---

## Project Structure

```
tenure/
├── app/
│   ├── page.tsx                  # Server entry — loads fixture session + memory
│   ├── layout.tsx
│   └── api/
│       ├── review/route.ts       # POST — runs live diff review
│       ├── memory/route.ts       # GET  — returns TeamMemory from Hindsight
│       ├── feedback/route.ts     # POST — stores accept/reject in Hindsight
│       └── stats/route.ts        # GET  — returns Impact Dashboard metrics
├── components/
│   ├── TenureApp.tsx             # Root client component
│   ├── DiffPanel.tsx             # Diff viewer + inline comments + input pane
│   ├── MemoryPanel.tsx           # Team Memory panel with tier callouts
│   ├── StatsBar.tsx              # Impact Dashboard bar
│   ├── ModeBar.tsx               # Top header
│   ├── TrustBadge.tsx            # BLOCK / WARN / SUGGEST badge
│   └── TrendIcon.tsx             # ↑ → ↓ — freshness trend indicator
├── hooks/
│   └── useLive.ts                # All live state: review, memory, stats, feedback
├── lib/
│   ├── hindsight.ts              # Hindsight client wrappers (retain/recall/reflect)
│   ├── reviewer.ts               # LLM prompt builder + OpenRouter call
│   ├── trust-tiers.ts            # computeTier() — proofCount + trend → tier
│   ├── rate-limit.ts             # Upstash rate limiter + lazy Redis singleton
│   ├── fixtures.ts               # Static fixture data for server-side initial load
│   └── replay.ts                 # Replay step logic (unused in production)
├── scripts/
│   ├── seed-and-export.ts        # Seeds Hindsight with real data, exports fixtures
│   └── setup-bank.ts             # Creates/configures Hindsight memory bank
├── types/
│   └── index.ts                  # Shared TypeScript types
└── public/
    └── fixtures/                 # Exported fixture JSON files
```

---

## Setup

### Prerequisites

- Node.js 18+
- An [Upstash](https://console.upstash.com) Redis database
- A [Hindsight Cloud](https://vectorize.io) account with a memory bank
- An [OpenRouter](https://openrouter.ai) API key

### 1. Clone and install

```bash
git clone https://github.com/vatsaltrivedi/tenure
cd tenure
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# OpenRouter — LLM gateway
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=anthropic/claude-3.5-haiku   # or any OpenRouter model ID

# Hindsight Cloud — memory engine
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_api_key
HINDSIGHT_BANK_ID=your_bank_id

# Upstash Redis — caching, rate limiting, stats
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### 3. Create the Hindsight memory bank

```bash
npx tsx scripts/setup-bank.ts
```

This creates a bank with the review-tuned missions and sets dispositions: skepticism 4/5, literalism 5/5, empathy 1/5.

### 4. Seed initial memory (optional but recommended)

```bash
npx tsx scripts/seed-and-export.ts
```

Runs 37 retain operations across three hero scenarios (self-suppression, observation revision, tier promotion), producing real conventions and exporting fixture files to `public/fixtures/`.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

All routes require Upstash to be configured. Unconfigured → 503. Rate-limited → 429 with `X-RateLimit-Reset` header.

---

### `POST /api/review`

Run a live diff review against Hindsight memory.

**Rate limit:** 100 requests / 24 hours

**Request body:**
```json
{
  "diff": "string",        // unified diff, partial diff, or plain code
  "filePath": "string"     // optional — used for display only
}
```

**Response `200`:**
```json
{
  "id": "live-abc123",
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

**Response `400`:** `{ "error": "Body must include a non-empty diff string" }`
**Response `500`:** `{ "error": "<actual error message>" }`

---

### `GET /api/memory`

Fetch the current team memory: conventions by tier, observations, and self-written style guide.

**Rate limit:** 30 requests / 24 hours

**Response `200`:**
```json
{
  "conventions": [
    {
      "id": "obs-uuid",
      "text": "Never use inline event handlers in JSX — extract to named functions.",
      "tier": "block",
      "proofCount": 7,
      "trend": "strengthening",
      "category": "react"
    }
  ],
  "observations": [
    {
      "id": "obs-uuid-2",
      "text": "The team consistently rejects suggestions about console.log removal.",
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

### `POST /api/feedback`

Record an accept or reject decision for a review comment. Trains the Hindsight memory bank.

**Rate limit:** 300 requests / 24 hours

**Request body:**
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

**Response `200`:**
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

`pending: true` means processing is still in flight (Hindsight async operation timed out at 20 s); the retain did succeed.

---

### `GET /api/stats`

Fetch all Impact Dashboard counters from Redis.

**Response `200`:**
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

**Response `503`:** Redis not configured.
**Response `500`:** Redis read failed (check credentials).

---

## Hindsight Bank Structure

Hindsight is Tenure's memory layer. It stores three types of facts in a single bank, all tagged for retrieval filtering.

### Bank Configuration

```
retainMission:       Extract team coding conventions and preferences as world facts.
                     Extract code review outcomes (accepted / rejected) as experience facts.

reflectMission:      Synthesise team standards and past review outcomes into
                     trust-calibrated, actionable feedback.

observationsMission: Identify recurring patterns: which conventions are consistently
                     accepted or rejected, how standards evolve, where trust should shift.

dispositionSkepticism: 4 / 5   (skeptical — does not extrapolate beyond evidence)
dispositionLiteralism: 5 / 5   (maximally literal — no interpretation)
dispositionEmpathy:    1 / 5   (direct — no softening)
```

### Fact Schema

#### World Facts — `context: "team convention / world fact"`

Objective team decisions. Written by `retainWorldFact()` on feedback accept.

```
content:  "Team accepts: Never use inline event handlers — extract to named functions."
tags:     ["tier:block", "convention:<obs-uuid>", "convention:accepted"]
```

Written by `retainWorldFact()` on feedback reject:

```
content:  "Team rejects: Add JSDoc comments to all public functions."
tags:     ["tier:suggest", "convention:<obs-uuid>", "convention:rejected"]
```

---

#### Experience Facts — `context: "code review outcome / experience"`

First-person review outcomes. Written by `retainExperienceFact()` alongside every world fact.

```
content:  "My block suggestion was accepted"
tags:     ["tier:block", "convention:<obs-uuid>", "outcome:accepted"]

content:  "My suggest suggestion was overruled"
tags:     ["tier:suggest", "convention:<obs-uuid>", "outcome:rejected"]
```

---

#### Observations — synthesised automatically by Hindsight

Hindsight distills world + experience facts into observations over time. These become conventions in the UI.

| Field | Type | Description |
|---|---|---|
| `id` | string | Hindsight-assigned UUID |
| `document_id` | string \| null | Groups related facts — used as convention ID in Tenure |
| `text` | string | Human-readable convention description |
| `proof_count` | number | How many supporting facts back this observation |
| `freshness_trend` | `"strengthening" \| "stable" \| "weakening" \| "stale"` | Direction of recent evidence |
| `tags` | string[] | Inherited from contributing facts |

---

### Tag Taxonomy

| Tag | Applied to | Meaning |
|---|---|---|
| `tier:block` | world + experience | Comment was from a block-tier convention |
| `tier:warn` | world + experience | Comment was from a warn-tier convention |
| `tier:suggest` | world + experience | Comment was from a suggest-tier convention |
| `convention:<id>` | world + experience | Links fact to specific convention document |
| `convention:accepted` | world | Team explicitly accepted this suggestion |
| `convention:rejected` | world | Team explicitly rejected this suggestion |
| `outcome:accepted` | experience | Reviewer's suggestion was accepted |
| `outcome:rejected` | experience | Reviewer's suggestion was overruled |

---

### Redis Key Schema

All keys are namespaced under `tenure:`.

| Key | Type | Incremented by |
|---|---|---|
| `tenure:stats:reviews` | counter | Every `/api/review` call |
| `tenure:stats:issues:total` | counter | Comments returned per review |
| `tenure:stats:issues:block` | counter | Block-tier comments per review |
| `tenure:stats:issues:warn` | counter | Warn-tier comments per review |
| `tenure:stats:issues:suggest` | counter | Suggest-tier comments per review |
| `tenure:stats:feedback:accepted` | counter | Every accepted feedback |
| `tenure:stats:feedback:rejected` | counter | Every rejected feedback |
| `tenure:review:<sha256[0:24]>` | JSON string | Review response cache (TTL: 1 hour) |
| `tenure:style-guide` | JSON string | Reflected style guide cache (TTL: 5 min) |
| `tenure:rl:<route>:<ip>` | ratelimit | Upstash sliding window per route |

---

## Trust Tier Logic

```typescript
function computeTier(proofCount: number, trend: FreshnessTrend): TrustTier {
  // Demotion takes priority — weakening/stale drops one tier
  if (trend === 'weakening' || trend === 'stale') {
    if (proofCount >= 5) return 'warn'    // would-be block, demoted
    return 'suggest'                       // would-be warn, demoted
  }
  if (proofCount >= 5 && (trend === 'stable' || trend === 'strengthening')) return 'block'
  if (proofCount >= 3 && trend === 'strengthening') return 'warn'
  return 'suggest'
}
```

---

## Team Health Score Formula

```
convScore  = (block×3 + warn×2 + suggest×1) / (total×3)
acceptRate = feedback.accepted / (feedback.accepted + feedback.rejected)
health     = round(min(convScore × 100, 100) × (0.4 + acceptRate × 0.6))
```

A team with all BLOCK conventions and 100% acceptance scores 100. A fresh team with no conventions scores 0. Acceptance rate is weighted at 60% — the team's trust in Tenure matters as much as Tenure's tier distribution.

---

## License

MIT
