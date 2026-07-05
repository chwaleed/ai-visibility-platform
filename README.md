# AI Visibility Platform

**Does AI mention your business when customers ask?** Register a business profile, run a 3-agent pipeline, and get back: the questions people ask AI assistants in your competitive space, whether your domain appears in the answers (with real search volume and difficulty), an opportunity score ranking every gap, and concrete content recommendations to close the biggest ones.

Built for the Full Stack Engineer assessment — **Task 1:** Flask API + multi-agent backend ([`backend/`](backend/README.md)) · **Task 2:** React dashboard ([`frontend/`](frontend/README.md)). Each sub-README documents that project's complete architecture; this file covers what the brief asks for: setup, architecture decisions, agent design rationale, model selection, the opportunity score formula, schema justification, and tradeoffs.

## Setup

### Backend (Task 1)

Prerequisites: [uv](https://docs.astral.sh/uv/) · Anthropic API key · SE Ranking API key (both optional for tests — every external call is mocked).

```bash
cd backend
cp .env.example .env        # fill in ANTHROPIC_API_KEY, SERANKING_API_KEY
uv sync
uv run flask db upgrade
uv run flask run            # → http://localhost:5000
uv run pytest               # 64 tests, no keys needed
```

### Frontend (Task 2)

```bash
cd frontend
pnpm install
cp .env.example .env        # VITE_API_BASE_URL, defaults to http://localhost:5000
pnpm dev                    # → http://localhost:5173
pnpm test                   # vitest component/unit tests
```

### Full stack via Docker

```bash
cp backend/.env.example backend/.env    # keys optional — pipeline degrades gracefully
docker compose up --build
```

API on http://localhost:5000, dashboard on http://localhost:3000. `VITE_API_BASE_URL` is a **build ARG** (Vite bakes env at build time) — set it in `docker-compose.yml`, not as a runtime env var.

All environment variables are listed in each project's `.env.example` (no real keys committed).

## Architecture decisions (summary)

- **Three separated agents + an orchestrator.** `QueryDiscoveryAgent` → `VisibilityScoringAgent` → `ContentRecommendationAgent`, coordinated by `execute_pipeline()`. Partial-failure policy: Agent 1 fails → run fails (nothing to score); one query's probe fails → that query is `unknown`, the run continues; Agent 3 fails → run completes without recommendations.
- **All LLM traffic through one module** (`app/agents/llm.py`) — agents never import the SDK; swapping providers is a one-file change. Structured outputs are schema-enforced (`messages.parse()` + Pydantic), spelled out in the prompts, and retried once before a typed error — the pipeline cannot crash on malformed LLM output.
- **All prompts in one reviewable file** (`app/agents/prompts.py`), each applying a research-backed technique — few-shot discovery, self-consistency probe voting, one-shot + chain-of-thought recommendations. Full rationale with citations in the [backend README](backend/README.md).
- **One response constructor** (`ApiResponse.ok/created/paginated/error`) — consistent success shapes and a uniform `{"error": {"code", "message"}}` envelope on every endpoint.
- **Frontend: one network boundary, two kinds of state.** All API calls live in `services/api.ts` (axios); TanStack Query owns server state, Zustand micro-stores own UI state only. Every data view renders loading / error / empty / filled.

**Task 2 stack choice (per brief):** React 19 + TypeScript (strict) with Vite; component library: Tailwind v4 + shadcn/ui; charts: recharts. Reasoning in the [frontend README](frontend/README.md).

## Agent design & model selection

| Agent | Responsibility | Model | Why this model |
|---|---|---|---|
| 1 · Query Discovery | 12–18 realistic questions + a priceable seed keyword + intent per question | `claude-sonnet-4-6` | Generation quality is the product — poor queries cascade into worthless scores. Sonnet delivers it at a fraction of Opus's cost |
| 2 · Visibility Scoring | Real volume/difficulty (SE Ranking, one batched call) + blind visibility probes (3 samples per query, majority vote) + opportunity score | `claude-haiku-4-5` | 36–54 parallel probe calls per run; the task is "answer like a consumer chatbot", so speed/cost dominate |
| 3 · Content Recommendations | 3–5 concrete content pieces targeting the worst gaps | `claude-sonnet-4-6` | Content strategy needs contextual reasoning; cheap models produce generic titles |

The probe prompt is **blind** — it never names the target business, because naming it would bias the very visibility check being simulated (test-enforced). Visibility per query is decided by **majority vote across 3 sampled answers** (self-consistency), because a single sample flips run-to-run on borderline queries.

## Opportunity score

```
score = 0.35·volume_n + 0.25·ease + 0.25·gap + 0.15·intent      ∈ [0, 1]

volume_n = min(1, log10(volume + 1) / 5)        # log-scaled demand, saturates at 100k
ease     = 1 − difficulty/100                    # winnability
gap      = 1.0 absent │ 0.7 unknown │ 0.4 mentioned-not-first │ 0.0 first mention
intent   = 1.0 transactional │ 0.7 commercial │ 0.3 informational
```

Reasoning: opportunity is demand-led (volume weighs most); being absent and being winnable matter equally next; buyer intent breaks ties. Log-scaling stops one whale keyword from crushing the ranking. `unknown` scores 0.7 on the gap factor — uncertainty is closer to opportunity than to safety. Pure function in `app/utils/scoring.py`, unit-tested for ordering properties.

## Data model & schema justification

Four tables — `business_profiles`, `pipeline_runs`, `discovered_queries`, `content_recommendations` — exactly the entities the domain has, no more. UUID string PKs (safe to expose in URLs, no enumeration). `discovered_queries` carries FKs to both its profile and the run that produced it, so results are queryable per-profile *and* auditable per-run. `competitors` and `target_keywords` are JSON columns — they're display lists, never queried relationally, so join tables would be over-modeling. Visibility is stored as nullable `domain_visible` (NULL = unknown) and the API's three-state `status` is derived — one fact, one column. Alembic migrations included. Full schema detail in the [backend README](backend/README.md).

## Real data (external API requirement)

Search volume and difficulty are **real numbers, never LLM-invented**. The brief's example provider (DataForSEO) proved account-gated at trial; because all provider calls were isolated in one module from day one, swapping to the **SE Ranking Keyword Research API** touched one file and was live-verified the same day. One batched call per run prices every keyword. If the key is absent or the call fails, the pipeline degrades to neutral defaults and keeps going.

## Bonus items implemented

- **Async pipeline execution** with a status polling endpoint (`POST .../run?async=1` → 202 + `GET /runs/<uuid>`) — the frontend uses this to show live progress
- **Rate limiting** on the pipeline trigger (5/min, Flask-Limiter)
- **Unit tests with mocked LLM responses** — 64 backend tests + 11 frontend tests, all runnable with zero API keys
- **Request validation with Pydantic** (bodies) and structured-output schemas (LLM responses)
- **Structured logging with a correlation ID** (`[run=<uuid>]`) on every pipeline log line
- **Docker Compose** for the full stack
- **Dark mode toggle** and a **pagination component with page-size control** (frontend)

## Tradeoffs (honest)

| Tradeoff | Why it's acceptable here | Upgrade path |
|---|---|---|
| Visibility is simulated with Claude, not measured across ChatGPT/Gemini/Perplexity | Single-provider probe with majority voting is a faithful, affordable proxy | DataForSEO LLM Mentions API — the provider seam already exists |
| Volume is keyed to an extracted keyword, not the natural-language question | Search APIs price keywords, not sentences; the prompt engineering enforces priceable keywords | Vector-match questions to keyword clusters |
| SQLite | Zero-setup for graders; SQLAlchemy abstracts the engine | Point `DATABASE_URL` at Postgres |
| Async = in-process daemon thread, not a task queue | No broker requirement in the brief; Celery for a single-worker demo is over-engineering | Celery/Redis behind the same `?async=1` contract |

## AI tools disclosure

Built with **Claude Code** (Anthropic) as pair programmer under human direction: architecture, task planning, and review loops were interactive; implementation ran task-by-task with tests first. All design decisions documented here — formula weights, provider choice, failure policies, model and prompt-technique selection — were deliberate.
