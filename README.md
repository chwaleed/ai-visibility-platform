# AI Visibility Platform

**Does AI mention your business when customers ask?** This platform finds out — and tells you what content to publish when the answer is no.

A business registers its profile, triggers a 3-agent AI pipeline, and gets back: the questions people ask AI assistants in its competitive space, whether the business appears in AI answers to each one (with real search volume and difficulty data), an opportunity score ranking every gap, and concrete content recommendations to close the biggest ones.

Built as a Full Stack Engineer assessment: **Flask API + multi-agent backend** (Task 1) and **React dashboard** (Task 2).

## How the pipeline works

```
Business Profile ("Frase", frase.io, competitors: [surferseo.com, ...])
      │
      ▼
┌──────────────────────────────────────────────────────────────────┐
│ AGENT 1 · Query Discovery              claude-sonnet-4-6         │
│ Generates 12–18 realistic questions users ask AI assistants in   │
│ this space, each with a priceable seed keyword + intent label.   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ AGENT 2 · Visibility Scoring           claude-haiku-4-5          │
│ • ONE batched SE Ranking call → real volume + difficulty         │
│ • Per query (5 parallel workers): Haiku answers the question     │
│   naturally → deterministic scan: is the domain in the answer?   │
│   At what position vs competitors?                               │
│ • Multi-factor opportunity score (pure function)                 │
│ • Any per-query failure → status "unknown", run continues        │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ AGENT 3 · Content Recommendations      claude-sonnet-4-6         │
│ Top ≤5 queries where the domain is ABSENT → 3–5 concrete         │
│ content pieces (type, title, rationale, keywords, priority).     │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
                   SQLite (SQLAlchemy + migrations)
```

## Key design decisions

- **All LLM traffic through one module** (`app/agents/llm.py`). Agents never import the SDK. Swapping providers = rewriting one ~80-line file. We deliberately did **not** build a provider interface for a single provider.
- **Structured outputs, belt and braces:** `messages.parse()` enforces the schema at the API layer, the same schema is spelled out inside each prompt, Pydantic validates, and one retry precedes a typed `AgentError`. The pipeline cannot crash on malformed LLM output.
- **Deliberate model split:** Sonnet 4.6 for generation (Agents 1 & 3) — strong structured output at a fraction of Opus's cost; Haiku 4.5 for Agent 2's 12–18 parallel visibility probes, where speed/cost matter and the task is "answer like a consumer chatbot."
- **The probe is blind.** Agent 2's prompt never mentions the target business — naming it would bias the very visibility check we're simulating. A dedicated test enforces this.
- **Brand matching in space-stripped text:** "Surfer SEO" in an answer matches domain root `surferseo` without fragile heuristics — and a surfing article does *not* count as a brand mention (tested).
- **Partial-failure policy** (assessment requirement): Agent 1 fails → run fails (nothing to score). One query's probe fails → that query is `unknown`, the run continues. Agent 3 fails → run completes without recommendations, error recorded.
- **Every response through one `ApiResponse` class** — consistent success shapes and `{"error": {"code", "message"}}` envelope everywhere.

## Opportunity score

```
score = 0.35·volume_n + 0.25·ease + 0.25·gap + 0.15·intent      ∈ [0, 1]

volume_n = min(1, log10(volume + 1) / 5)        # log-scaled demand, saturates at 100k
ease     = 1 − difficulty/100                    # winnability
gap      = 1.0 absent │ 0.7 unknown │ 0.4 mentioned-not-first │ 0.0 first mention
intent   = 1.0 transactional │ 0.7 commercial │ 0.3 informational
```

Reasoning: opportunity is demand-led (volume weighs most); being absent and being winnable matter equally next; buyer intent breaks ties. Log-scaling stops one whale keyword from crushing the ranking. "Unknown" visibility scores 0.7 on the gap factor — uncertainty is closer to opportunity than to safety. Implemented as a pure function (`app/utils/scoring.py`), unit-tested for ordering properties.

## Real data — and an honest provider story

Search volume and difficulty are **real numbers**, never LLM-invented. The assessment names "DataForSEO etc." as example providers — we started there, and its trial proved account-gated in practice (verification wall, then an activity pause; error codes 40104/40201). Because every provider call was isolated in one module from day one, switching to the **SE Ranking Keyword Research API** touched exactly one file plus two import lines, and was live-verified the same day. One batched call per pipeline run returns volume + difficulty for every keyword (100 credits flat; the free 100K credits ≈ 1,000 runs, no card required).

Production upgrade path worth noting: DataForSEO's LLM Mentions API could check visibility across ChatGPT/Gemini/Perplexity answers directly, replacing our single-model simulation.

## Backend setup

Prerequisites: [uv](https://docs.astral.sh/uv/) · an Anthropic API key · an SE Ranking API key (both optional for tests; the pipeline degrades gracefully without the data key).

```bash
cd backend
cp .env.example .env        # fill in ANTHROPIC_API_KEY, SERANKING_API_KEY
uv sync
uv run flask --app app db upgrade
uv run flask --app app run           # http://localhost:5000
```

Run the tests (no API keys needed — every external call is mocked):

```bash
uv run pytest
```

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | LLM calls (Agents 1–3). Tests run without it |
| `SERANKING_API_KEY` | Real volume/difficulty data. Absent → neutral defaults, run continues |
| `DATABASE_URL` | Default `sqlite:///dev.db` |
| `SECRET_KEY` | Flask secret |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `RATELIMIT_ENABLED` | `true`/`false` (tests disable it) |

## Frontend setup

```bash
cd frontend
pnpm install
cp .env.example .env         # VITE_API_BASE_URL, defaults to http://localhost:5000
pnpm dev                     # http://localhost:5173
```

See [`frontend/README.md`](frontend/README.md) for the architecture (single axios boundary,
Query for server state / Zustand for UI state, four-state views, token-only theming).

## Full stack via Docker

```bash
cp backend/.env.example backend/.env    # fill in keys (optional — pipeline degrades without them)
docker compose up --build
```

API on http://localhost:5000, dashboard on http://localhost:3000. `VITE_API_BASE_URL` is a
**build ARG** (Vite bakes env at build time) — set it in `docker-compose.yml` under the frontend
service, not as a runtime env var.

## Repository layout

```
backend/            Flask API — app factory, blueprints, agents, orchestrator
  app/agents/       llm.py (ALL Anthropic calls) · discovery.py · scoring.py ·
                    seranking.py (keyword data) · recommendation.py
  app/services/     pipeline.py — orchestrator + run payload builder
  app/utils/        responses.py (ApiResponse) · scoring.py (opportunity formula)
  app/models/       4 SQLAlchemy models, UUID PKs, Alembic migrations
  tests/            59 tests, all external calls mocked
frontend/           React + TypeScript dashboard (Vite, shadcn/ui, TanStack Query, Zustand)
  src/services/     api.ts — the single network boundary (axios + ApiError envelope)
  src/hooks/        one hook per resource + usePipeline (trigger + poll)
  src/pages/        Dashboard · CreateProfile · ProfileDetail (Overview/Queries/Recs/Runs tabs)
docs/               assessment brief · design spec · implementation plans
```

## Testing philosophy

A few tests that verify behavior beat a hundred that verify mocks: formula *ordering* properties (more volume ⇒ higher score; absent ⇒ beats visible), agent prompt/parse contracts with malformed-output fallbacks, orchestrator partial-failure paths (one probe dies → run completes; Agent 1 dies → run fails), brand-matching precision (a surfing article is not a brand mention), and a thread-safety-conscious usage accumulator. Everything runs keyless in ~1 second.

## AI tools disclosure

Built with Claude (Claude Code) as pair programmer under human direction: architecture decisions, task planning, code review loops, and API research were interactive; implementation was executed task-by-task with tests written first and each task independently reviewed. All design decisions (score formula, provider choice, failure policies, model selection) were deliberate and are documented above and in `docs/`.
