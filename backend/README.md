# Backend — AI Visibility Platform

## 1. What this is

A 3-agent Flask API that answers: "Does AI mention your business when customers ask it questions in your space?" A business profile triggers a pipeline: Agent 1 (claude-opus-4-8) generates 12–18 realistic questions people ask AI assistants in that competitive space; Agent 2 (claude-haiku-4-5) pulls real search volume + difficulty via SE Ranking, then probes each question with Haiku acting as a natural consumer chatbot and checks deterministically whether the domain appears; Agent 3 (claude-opus-4-8) reads the worst gaps and produces 3–5 concrete content pieces to close them. Results persist in SQLite; every query gets an opportunity score ranking the best moments to invest content effort.

---

## 2. Setup (< 5 min)

**Prerequisites:** [uv](https://docs.astral.sh/uv/) ≥ 0.5 · Python 3.12 · Anthropic API key · SE Ranking API key (both optional for tests).

```bash
cd backend
cp .env.example .env       # fill ANTHROPIC_API_KEY, SERANKING_API_KEY, SECRET_KEY
uv sync
uv run flask db upgrade
uv run flask run           # → http://localhost:5000
```

**Or from the repo root with Docker (no Python install needed):**

```bash
docker compose up          # builds backend, runs migrations, starts on :5000
```

**Run the full test suite (no API keys needed — all external calls are mocked):**

```bash
uv run pytest              # 57 tests, ~1 s
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

---

## 3. API reference

All endpoints are under `/api/v1`. Success bodies are bare (no wrapping key). Errors use `{"error": {"code": "...", "message": "..."}}`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/profiles` | Create a business profile |
| `GET` | `/profiles` | List all profiles (with stats) |
| `GET` | `/profiles/<uuid>` | Get one profile + stats |
| `POST` | `/profiles/<uuid>/run` | Run the full 3-agent pipeline (sync default; `?async=1` for background) |
| `GET` | `/profiles/<uuid>/runs` | Pipeline run history |
| `GET` | `/runs/<run_uuid>` | Get one run's full payload |
| `GET` | `/profiles/<uuid>/queries` | Scored queries (`?min_score=`, `?status=`, `?page=`, `?per_page=`) |
| `GET` | `/profiles/<uuid>/recommendations` | Content recommendations from last Agent 3 run |
| `POST` | `/queries/<uuid>/recheck` | Re-probe a single query (live LLM + SE Ranking call) |

### Key curl examples

**Create a profile:**
```bash
curl -s -X POST http://localhost:5000/api/v1/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Frase","domain":"frase.io","industry":"SEO Content Tools",
       "description":"AI content briefs","competitors":["surferseo.com","clearscope.io"]}'
# → 201  {"profile_uuid": "...", "name": "Frase", "domain": "frase.io", ...}
```

**Run the pipeline (sync — waits for completion, 30–120 s):**
```bash
curl -s --max-time 300 -X POST \
  http://localhost:5000/api/v1/profiles/<profile_uuid>/run
# → 200  {"run_uuid":"...","status":"completed","queries_discovered":15,
#          "tokens_used":{"input":...,"output":...}, "queries":[...], "recommendations":[...]}
```

**Run async (returns immediately, poll /runs/<run_uuid>):**
```bash
curl -s -X POST "http://localhost:5000/api/v1/profiles/<profile_uuid>/run?async=1"
# → 202  {"run_uuid":"...","status":"running","poll":"/api/v1/runs/<run_uuid>"}
```

**Top opportunities:**
```bash
curl -s "http://localhost:5000/api/v1/profiles/<uuid>/queries?min_score=0.5&status=not_visible"
```

---

## 4. Architecture decisions

**App factory + blueprints.** `create_app()` in `app/__init__.py` wires two blueprints (`profiles_bp`, `queries_bp`) under `/api/v1`. This keeps route modules focused and lets tests call `create_app("testing")` cleanly.

**`ApiResponse` as the single response-construction point.** `app/utils/responses.py` exposes four class-methods: `ok`, `created`, `paginated`, `error`. No route builds a response dict by hand. The error envelope is always `{"error": {"code": "...", "message": "..."}}`. This was an explicit assessment requirement; it also means changing the response shape is a one-file edit.

**Agent separation.** Three agent classes + a pipeline orchestrator:
- `DiscoveryAgent` (Agent 1) — query generation, structured output.
- `VisibilityScoringAgent` (Agent 2) — SE Ranking call + parallel probes + scoring.
- `RecommendationAgent` (Agent 3) — content recommendations from top gaps.
- `execute_pipeline()` in `app/services/pipeline.py` — orchestrator; never touches the SDK directly.

**Failure policy (assessment requirement):**
- Agent 1 fails → run status `failed`, nothing to score. Run aborts.
- Per-query probe fails (network, timeout, malformed) → that query gets `status: unknown`, `opportunity_score` uses `gap=0.7` (the uncertainty default). Run continues for all other queries.
- Agent 3 fails → run completes with `status: completed`, `error_message` records what went wrong, recommendations list is empty.

**Dual-mode execution.** Sync default: `POST /profiles/<uuid>/run` blocks until complete and returns the full payload — good for graders, integrations, and tests. `?async=1` spins a daemon thread and returns 202 immediately; callers poll `/runs/<run_uuid>`. Celery/Redis was deliberately skipped: the assessment has no message-broker requirement and adding one for a single-worker demo is over-engineering. The thread approach is documented as a known ceiling (see §9).

**Rate limiting.** `POST /profiles/<uuid>/run` is limited to 5 per minute via Flask-Limiter. Tests disable it with `RATELIMIT_ENABLED=false`.

**Correlation logging.** `execute_pipeline()` attaches a `correlation_id` (the `run_uuid`) to every log line so a failing run's full trace is greppable with one ID.

---

## 5. Model selection (deliberate)

| Agent | Model | Why |
|---|---|---|
| Agent 1 — Query Discovery | `claude-opus-4-8` | Generation quality is the product. Poor queries cascade into worthless scores. |
| Agent 2 — Visibility probes | `claude-haiku-4-5` | 12–18 parallel calls; Haiku answers like a real consumer chatbot. Speed and cost matter; the task is "answer naturally," not "reason carefully." |
| Agent 3 — Recommendations | `claude-opus-4-8` | Content strategy requires contextual reasoning. A cheap model produces generic titles. |

**Provider portability.** Agents never import the Anthropic SDK. Every LLM call routes through two functions in `app/agents/llm.py`: `generate_structured()` (schema-enforced via `messages.parse()`) and `generate_text()` (free-text probes). Swapping providers means reimplementing that one ~90-line file.

---

## 6. Opportunity score formula

```
score = 0.35·volume_n + 0.25·ease + 0.25·gap + 0.15·intent_w    ∈ [0, 1]

volume_n = min(1, log10(volume + 1) / 5)     # log-scaled demand, saturates at 100k
ease     = 1 − difficulty / 100              # winnability (lower difficulty = more winnable)
gap      = 1.0  absent                       # not in the answer at all
         | 0.7  unknown                      # probe failed — uncertainty treated as opportunity
         | 0.4  mentioned but not first      # visible but not leading
         | 0.0  first mention               # already winning
intent_w = 1.0  transactional
         | 0.7  commercial
         | 0.3  informational
```

**Rationale:**
- Volume (0.35) weighs most — opportunity is demand-led. No point winning a query nobody asks.
- Ease and gap (0.25 each) are equal — being winnable and being absent matter as much as each other.
- Intent (0.15) breaks ties — a buyer-intent gap is worth more than an informational one.
- Log-scaling volume stops one high-volume keyword from compressing every other query to near-zero.
- `unknown → 0.7`: a probe failure is closer to "missed opportunity" than to "already visible." Conservative but directionally correct.

Implemented as a pure function in `app/utils/scoring.py`, no side effects, fully unit-tested for ordering properties.

---

## 7. Real data & the provider story

Search volume and difficulty are **real numbers from a live API**, not LLM estimates. The assessment named "DataForSEO etc." as example providers. We started there.

**What happened with DataForSEO:** Its trial proved account-gated in practice. The account hit a verification wall (error 40104) followed by an activity pause (error 40201) before a single real call completed. Both errors came from DataForSEO's trial tier controls, not from our integration.

**The swap:** Because every provider call was isolated behind `fetch_keyword_metrics()` in a single module from day one (`app/agents/seranking.py`), switching to **SE Ranking's Keyword Research API** touched exactly one file plus two import lines. The rest of the codebase — agents, orchestrator, tests — never changed. The swap was live-verified the same day.

**SE Ranking integration:** One batched POST to `/v1/keywords/export` per pipeline run sends all discovered keywords at once and gets back volume + difficulty together. Cost: 100 credits flat per run. SE Ranking's free tier includes 100,000 credits ≈ 1,000 full pipeline runs with no card required.

**Graceful degradation:** If the SE Ranking key is absent or the call fails, `fetch_keyword_metrics()` returns `{keyword: 0}` volumes and `{keyword: 50}` difficulties (neutral mid-difficulty defaults). The pipeline continues; queries are scored on available signal. This is logged at WARNING level.

**Production upgrade path:** DataForSEO's LLM Mentions API checks visibility directly in ChatGPT, Gemini, and Perplexity responses — replacing our single-model simulation with cross-model ground truth. The isolation seam is already in place.

---

## 8. Prompt engineering

**Where prompts live:** Each agent class defines its system prompt as a module-level constant (`PROBE_SYSTEM` in `scoring.py`, full prompts in `discovery.py` and `recommendation.py`). No prompts are in config files or the database.

**Schema-in-prompt + `parse()` enforcement:** For Agents 1 and 3, the output schema (field names, types, constraints) is spelled out in plain text inside the system prompt and simultaneously enforced via `messages.parse(output_format=MyPydanticModel)`. The API layer cannot return malformed JSON; the prompt keeps the contract human-readable. One retry precedes a typed `AgentError` with the original exception attached.

**The probe prompt is blind:** Agent 2's system prompt (`PROBE_SYSTEM` in `app/agents/scoring.py`) never mentions the target business, the domain, or the competitors. Naming the target would prime the model to include or exclude it — invalidating the visibility simulation. A dedicated test (`test_probe_not_biased`) asserts the prompt string contains neither `profile.domain` nor `profile.name`.

**Retry layer:** `generate_structured()` in `llm.py` makes two attempts before raising `AgentError`. Per-query `generate_text()` calls in Agent 2 are wrapped in `try/except` inside the `probe()` closure — any exception marks the query `unknown` and the next query proceeds.

---

## 9. Tradeoffs & honest limitations

| What | What it means | Upgrade path |
|---|---|---|
| Visibility simulated via Claude | We ask Haiku to answer naturally and check if the domain appears — not actual ChatGPT, Gemini, or Perplexity. Different models answer differently. | DataForSEO LLM Mentions API for cross-model ground truth |
| Volume keyed to extracted keyword, not the full question | SE Ranking returns data for short keywords (`"seo content tools"`), not for natural-language questions. Volume reflects search demand, not AI-query frequency. | Vector-match full questions to keyword clusters |
| SQLite | Works out of the box; not concurrent-write safe under high load. | Swap `DATABASE_URL` to Postgres — SQLAlchemy abstracts the rest |
| In-process daemon thread for async | Single-worker Flask; thread shares process resources; a crash kills the run silently. No task queue. | Celery + Redis; change `?async=1` code path only |
| `unknown` visibility counts as a gap (0.7) | Conservative heuristic. A probe failure could mask an already-visible result. | Retry policy per query; flag `unknown` separately in the UI |

---

## 10. AI tools disclosure

Built with **Claude Code** (Anthropic) as pair programmer under human direction. Architecture decisions, task planning, and code-review loops were interactive. Implementation ran task-by-task with tests written first; each task was independently reviewed before the next began. All design decisions documented in this README and in `docs/` — score formula weights, provider choice, failure policies, model selection — were deliberate choices made by the engineer. The AI accelerated execution; the judgment was human.
