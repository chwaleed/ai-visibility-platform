# Backend — AI Visibility Intelligence API (Task 1)

## 1. What this is

A 3-agent Flask API that answers: "Does AI mention your business when customers ask it questions in your space?" A business profile triggers a pipeline: **Agent 1** (`claude-sonnet-4-6`) generates 12–18 realistic questions people ask AI assistants in that competitive space; **Agent 2** (`claude-haiku-4-5`) pulls real search volume + difficulty via SE Ranking, then probes each question with Haiku acting as a natural consumer chatbot — **3 independent samples per query, visibility decided by majority vote** — and checks deterministically whether the domain appears; **Agent 3** (`claude-sonnet-4-6`) reads the worst gaps and produces 3–5 concrete content pieces to close them. Results persist in SQLite; every query gets an opportunity score.

## 2. Setup (< 5 min)

**Prerequisites:** [uv](https://docs.astral.sh/uv/) · Python 3.12 · Anthropic API key · SE Ranking API key (both optional for tests).

```bash
cd backend
cp .env.example .env       # fill ANTHROPIC_API_KEY, SERANKING_API_KEY, SECRET_KEY
uv sync
uv run flask db upgrade
uv run flask run           # → http://localhost:5000
```

**Or from the repo root with Docker (no Python install needed):**

```bash
cp backend/.env.example backend/.env   # compose's env_file requires the file; placeholder keys still work (graceful degradation)
docker compose up          # builds backend, runs migrations, starts on :5000
```

**Run the full test suite (no API keys needed — all external calls are mocked):**

```bash
uv run pytest              # 64 tests, ~2 s
```

### Environment variables

| Variable | Purpose | Required for tests |
|---|---|---|
| `ANTHROPIC_API_KEY` | LLM calls (Agents 1–3) | No — mocked |
| `SERANKING_API_KEY` | Real volume + difficulty data | No — mocked |
| `DATABASE_URL` | Default: `sqlite:///dev.db` | No |
| `SECRET_KEY` | Flask secret | No |
| `CORS_ORIGINS` | Comma-separated allowed origins | No |
| `RATELIMIT_ENABLED` | `true`/`false` — tests set `false` | No |

## 3. Architecture

### Module map

```
app/
├── __init__.py            create_app() factory: config, extensions, CORS,
│                          blueprints, error handlers
├── config.py              env-driven Config
├── extensions.py          db (SQLAlchemy), migrate (Alembic), limiter
├── api/
│   ├── profiles.py        profiles CRUD, pipeline trigger (sync + async),
│   │                      run polling, run history, recommendations
│   └── queries.py         query list (filters + pagination), single-query recheck
├── schemas/
│   ├── requests.py        Pydantic request validation (ProfileCreate)
│   └── agent_outputs.py   Pydantic schemas the LLM must satisfy
├── services/
│   └── pipeline.py        orchestrator: Agent 1 → 2 → 3, partial-failure
│                          policy, correlation-ID logging, run payload builder
├── agents/
│   ├── llm.py             THE ONLY module that imports the Anthropic SDK
│   ├── prompts.py         ALL prompts, one reviewable file
│   ├── discovery.py       Agent 1 · QueryDiscoveryAgent
│   ├── scoring.py         Agent 2 · VisibilityScoringAgent (+ self-consistency vote)
│   ├── seranking.py       SE Ranking client (real volume/difficulty)
│   └── recommendation.py  Agent 3 · ContentRecommendationAgent
├── models/                4 SQLAlchemy models (see §6)
└── utils/
    ├── responses.py       ApiResponse — the single response constructor
    └── scoring.py         opportunity score, pure function
migrations/                Alembic
tests/                     64 tests, every external call mocked
```

### Request flow

```
HTTP → blueprint route → Pydantic validation → service/agent → SQLAlchemy → ApiResponse
```

Every response goes through `ApiResponse.ok / created / paginated / error` — no route hand-builds a response. Success bodies are bare (spec-shaped); errors are always `{"error": {"code": "...", "message": "..."}}`. Global handlers cover 404/405/429/500 and Pydantic `ValidationError` (400 with per-field details).

### The pipeline (orchestration + failure policy)

`execute_pipeline()` in `services/pipeline.py` runs Agent 1 → 2 → 3 in sequence and owns the failure policy (an assessment requirement):

- **Agent 1 fails** → run `failed` — there is nothing to score. The stored `error_message` is a user-friendly sentence; the raw exception stays in the logs.
- **One query's probe fails** → that query is stored with `domain_visible = NULL` ("unknown"), scored with the uncertainty gap weight, and the run continues.
- **Agent 3 fails** → run still `completed` (queries are valuable alone); `error_message` records that recommendations are missing.

Every pipeline log line is prefixed `[run=<run_uuid>]` via a `LoggerAdapter` — one grep reconstructs a run's full trace (the "correlation ID" bonus).

**Dual-mode execution:** `POST /profiles/<uuid>/run` is synchronous by default (returns the full run payload — good for graders and curl). `?async=1` starts a daemon thread and returns `202` with a poll URL; the frontend polls `GET /runs/<uuid>` every 2 s. Celery/Redis was deliberately skipped — a broker for a single-worker demo is over-engineering; the seam to add it is the `?async=1` code path only.

**Rate limiting:** the trigger endpoint is limited to 5/min (Flask-Limiter); tests disable via `RATELIMIT_ENABLED=false`.

## 4. API reference

All endpoints under `/api/v1`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/profiles` | Create a business profile (201) |
| `GET` | `/profiles` | List all profiles with stats |
| `GET` | `/profiles/<uuid>` | One profile + summary stats |
| `POST` | `/profiles/<uuid>/run` | Run the pipeline (sync default; `?async=1` → 202 + poll URL) |
| `GET` | `/runs/<run_uuid>` | One run's full payload (status, counts, tokens, top-3 queries, recommendations) |
| `GET` | `/profiles/<uuid>/runs` | Run history |
| `GET` | `/profiles/<uuid>/queries` | Scored queries, sorted by score desc (`?min_score=` `?status=` `?page=` `?per_page=`) |
| `GET` | `/profiles/<uuid>/recommendations` | Content recommendations |
| `POST` | `/queries/<uuid>/recheck` | Re-run Agent 2 on one query (live call) |

```bash
# create
curl -s -X POST http://localhost:5000/api/v1/profiles -H "Content-Type: application/json" \
  -d '{"name":"Frase","domain":"frase.io","industry":"SEO Content Tools",
       "description":"AI content briefs","competitors":["surferseo.com","clearscope.io"]}'

# run (sync, 30–120 s)
curl -s --max-time 300 -X POST http://localhost:5000/api/v1/profiles/<uuid>/run

# run (async) then poll
curl -s -X POST "http://localhost:5000/api/v1/profiles/<uuid>/run?async=1"
curl -s http://localhost:5000/api/v1/runs/<run_uuid>

# top gaps
curl -s "http://localhost:5000/api/v1/profiles/<uuid>/queries?min_score=0.5&status=not_visible"
```

## 5. Agents & model selection

| Agent | Class | Model | Why |
|---|---|---|---|
| 1 · Query Discovery | `QueryDiscoveryAgent` | `claude-sonnet-4-6` | Generation quality is the product; poor queries cascade into worthless scores. Sonnet delivers without Opus-level cost |
| 2 · Visibility Scoring | `VisibilityScoringAgent` | `claude-haiku-4-5` | 36–54 parallel probe calls per run (3 per query); the task is "answer like a consumer chatbot" — speed/cost dominate |
| 3 · Recommendations | `ContentRecommendationAgent` | `claude-sonnet-4-6` | Content strategy needs contextual reasoning; cheap models produce generic titles |

**Provider portability.** Agents never import the Anthropic SDK. Every call routes through two functions in `agents/llm.py`: `generate_structured()` (schema-enforced via `messages.parse()`, one retry, then typed `AgentError`) and `generate_text()` (free-text probes). Swapping providers = reimplementing that one ~90-line file.

**Agent 2 internals.** One batched SE Ranking call prices all keywords (keys normalized case-insensitively — SE Ranking lowercases its echo). Then per query: 3 independent Haiku answers sampled in a shared thread pool, deterministic brand matching in space-stripped text ("Surfer SEO" matches `surferseo`; a surfing article does **not** count — tested), and a majority vote decides visibility. Ties and all-failed → `unknown`, never a guess.

## 6. Data model & schema justification

| Table | Key fields | Notes |
|---|---|---|
| `business_profiles` | uuid PK, name, domain, industry, description, competitors **JSON**, status, created/updated_at | competitors is a display list, never queried relationally — a join table would be over-modeling |
| `pipeline_runs` | uuid PK, profile_uuid FK, status, queries_discovered, queries_scored, tokens_used, error_message, started/completed_at | one row per trigger; the audit trail the Runs tab renders |
| `discovered_queries` | uuid PK, profile_uuid FK, run_uuid FK, query_text, keyword, intent, volume, difficulty, opportunity_score, domain_visible (**nullable bool**), visibility_position, discovered_at | double FK: queryable per-profile *and* auditable per-run. `NULL` visibility = unknown; the 3-state API `status` is a derived property — one fact, one column |
| `content_recommendations` | uuid PK, profile_uuid FK, query_uuid FK, run_uuid FK, content_type, title, rationale, target_keywords **JSON**, priority, created_at | each rec targets exactly one query (the gap it closes) |

UUID string PKs throughout (URL-safe, non-enumerable). Timestamps on everything. Alembic migrations in `migrations/`.

## 7. Opportunity score

```
score = 0.35·volume_n + 0.25·ease + 0.25·gap + 0.15·intent_w    ∈ [0, 1]

volume_n = min(1, log10(volume + 1) / 5)     # log-scaled demand, saturates at 100k
ease     = 1 − difficulty / 100              # winnability
gap      = 1.0 absent │ 0.7 unknown │ 0.4 mentioned-not-first │ 0.0 first mention
intent_w = 1.0 transactional │ 0.7 commercial │ 0.3 informational
```

Volume weighs most (opportunity is demand-led); ease and gap are equal seconds; intent breaks ties. Log-scaling stops one whale keyword from compressing everything else. `unknown → 0.7`: a failed probe is closer to "missed opportunity" than "already visible." Pure function in `utils/scoring.py`, unit-tested for ordering properties.

## 8. Prompt engineering — technique per agent

All prompts live in **one reviewable file, [`app/agents/prompts.py`](app/agents/prompts.py)** — agents import constants and define no prompt strings of their own. Each prompt applies a researched technique chosen for that agent's observed failure mode:

| Agent | Technique | Why |
|---|---|---|
| 1 · Discovery | **Few-shot** — 4 demonstrations balanced across the 3 intent labels, plus an explicit BAD-keyword counter-example | The `keyword` field feeds real SE Ranking lookups; sentence-like keywords measurably return no data. Demonstrations teach format/label-space better than descriptions (Brown et al. 2020, [arXiv:2005.14165](https://arxiv.org/abs/2005.14165); Min et al. 2022, [arXiv:2202.12837](https://arxiv.org/abs/2202.12837)); label-balanced examples avoid majority-label bias (Zhao et al. 2021, [arXiv:2102.09690](https://arxiv.org/abs/2102.09690)). Sparse-profile edge case handled explicitly |
| 2 · Probe | **Deliberately zero-shot** prompt; **self-consistency** in code (3 samples, majority vote, ties → unknown) | Few-shot here would be a bug — example answers naming tools would bias which brands the model mentions. The prompt also never names the target business (test-enforced). Single-sample variance (visibility flipping between identical runs) is exactly what self-consistency addresses (Wang et al. 2022, [arXiv:2203.11171](https://arxiv.org/abs/2203.11171)) |
| 3 · Recommendations | **One-shot worked example + mechanical calibration + light chain-of-thought** | The worked example anchors title/rationale specificity; priority is assigned from explicit score thresholds (≥0.70 high / 0.50–0.69 medium / else low) instead of drift-prone relative wording; a diagnose-gap → choose-format step sequences the reasoning (Wei et al. 2022, [arXiv:2201.11903](https://arxiv.org/abs/2201.11903)) |

**Malformed-output defense in depth:** schema spelled out in the prompt → `messages.parse()` enforces it at the API layer → Pydantic validates → one retry → typed `AgentError` the orchestrator degrades on. A hallucinated `target_query_uuid` from Agent 3 is reassigned to a valid gap rather than crashing.

Rejected techniques: self-consistency for Agents 1/3 (generative outputs have no single answer to vote on), Tree-of-Thoughts/ReAct scaffolding (over-engineering for a 3-step pipeline).

## 9. Real data & the provider story

Volume and difficulty are **real numbers from a live API**, never LLM estimates. The brief's example provider (DataForSEO) hit a trial verification wall (errors 40104/40201) before a single real call completed. Because every provider call sat behind `fetch_keyword_metrics()` in one module from day one, swapping to **SE Ranking's Keyword Research API** touched exactly one file plus two import lines — live-verified the same day. One batched POST per run prices all keywords (100 credits flat; the free 100K credits ≈ 1,000 runs). Key absent or call failed → neutral defaults (volume 0, difficulty 50), logged at WARNING, run continues.

## 10. Testing philosophy

A few tests that verify behavior beat a hundred that verify mocks (64 tests, ~2 s, zero keys): formula *ordering* properties (more volume ⇒ higher score; absent ⇒ beats visible), agent prompt/parse contracts with malformed-output fallbacks, orchestrator partial-failure paths, brand-matching precision (a surfing article is not a brand mention), keyword case-normalization against SE Ranking's lowercased echo, self-consistency voting (majority wins; a 1–1 tie is `unknown`), probe-prompt blindness, and a thread-safety-conscious usage accumulator.

## 11. Tradeoffs & honest limitations

| What | What it means | Upgrade path |
|---|---|---|
| Visibility simulated via Claude | Haiku answering naturally ≠ actual ChatGPT/Gemini/Perplexity answers | DataForSEO LLM Mentions API; the provider seam exists |
| Volume keyed to extracted keyword | Search APIs price keywords, not questions | Vector-match questions to keyword clusters |
| SQLite | Not concurrent-write safe under load | Swap `DATABASE_URL` to Postgres |
| Daemon thread for async | No task queue; a process crash kills the run | Celery + Redis behind the same `?async=1` contract |
| `unknown` counts as gap 0.7 | A failed probe could mask an already-visible result | Per-query retry policy; surface `unknown` distinctly (the UI already does) |
