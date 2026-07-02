# AI Visibility Intelligence Platform — Design Spec

**Date:** 2026-07-03 · **Status:** Approved pending user review
**Source requirements:** `docs/FullStack_Assessment.md` (Full Stack Engineer assessment, Tasks 1 & 2)
**Goal:** Full marks on both rubrics. Guiding constraint: simplicity and clarity beat over-engineering (stated in the brief itself).

---

## 1. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | Flask + SQLAlchemy + **SQLite** + Flask-Migrate | Brief-mandated except DB; SQLite = zero cold-start risk |
| Python tooling | **uv** (pyproject.toml) | User choice |
| LLM provider | **Anthropic only**, centralized in `app/agents/llm.py` | No provider interface for one provider; swap = rewrite one ~40-line file. Documented in README |
| Models | **Opus 4.8** (`claude-opus-4-8`) for Agents 1 & 3; **Haiku 4.5** (`claude-haiku-4-5`) for Agent 2 visibility probes | Quality where generation matters; speed/cost for 15–20 parallel simple probes. "Deliberate model selection" README criterion |
| Structured output | `client.messages.parse()` + Pydantic models (Agents 1 & 3); free-text `messages.create()` for Agent 2 probes | Schema-enforced JSON at API level + prompt-level schema + fallback = full marks path on prompt engineering |
| Real data | **SE Ranking Keyword Research API** — `POST /v1/keywords/export?source=us` (`Authorization: Token`), ONE batched call per run returns `volume` + `difficulty` (0–100) per keyword. Live-verified 2026-07-03 | Brief names "DataForSEO etc." — DataForSEO's trial proved account-gated (40104 verification wall / 40201 pause), so we exercised the provider seam: swap touched one module. 100K free credits ≈ 1,000 runs, no card. Full story in README |
| Pipeline execution | **Dual-mode**: default sync (spec-exact response); `?async=1` → 202 + `run_uuid`, `threading.Thread`, poll `GET /api/v1/runs/{run_uuid}` | Spec-verbatim for reviewers + async bonus + powers frontend live status. No Celery |
| Frontend | React + TypeScript + **Vite**, **Tailwind + shadcn/ui**, TanStack Query, react-router, Recharts (shadcn charts), **pnpm** | User choice + brief |
| State management | **TanStack Query** owns server state (fetching, cache, loading/error, polling); **Zustand micro-stores** own UI/business state on complex pages (logic + actions). **Rule: server data is never copied into a store** | Logic and JSX kept separate; testable without rendering; no dual source of truth |
| API responses | Every endpoint returns through an **`ApiResponse` class** (`utils/responses.py`): `.ok/.created/.paginated/.error` | Single construction point = consistency. Success bodies stay spec-shaped (brief's documented responses are bare objects); errors get the envelope |
| Validation | **Pydantic v2** everywhere (request bodies + agent output schemas) | One dep covers bonus item + structured outputs |
| Repo | Monorepo: `backend/` + `frontend/` + root README + `docker-compose.yml` | Brief allows monorepo |
| Rejected | LangChain, RAG, Postgres, Celery, provider abstraction, Storybook | Over-engineering / no payoff for rubric |

**Open item:** Figma design access (node 3015-34) is blocked — user must duplicate the file to their Figma drafts and share their copy's URL. Frontend visual detail follows the brief's screen list until then; layout/styling will be reconciled to Figma when available.

---

## 2. Repo layout

```
d:\Assment\
├── backend/
│   ├── app/
│   │   ├── __init__.py            # create_app() factory, error handlers, CORS, limiter
│   │   ├── config.py              # env-driven config (dotenv)
│   │   ├── extensions.py          # db, migrate, limiter singletons
│   │   ├── models/                # profile.py, run.py, query.py, recommendation.py
│   │   ├── agents/
│   │   │   ├── llm.py             # ALL Anthropic calls: generate_structured(), generate_text(); returns (result, usage)
│   │   │   ├── discovery.py       # Agent 1
│   │   │   ├── scoring.py         # Agent 2 (DataForSEO client + visibility probes)
│   │   │   └── recommendation.py  # Agent 3
│   │   ├── api/
│   │   │   ├── profiles.py        # Blueprint: profiles, run, runs, recommendations
│   │   │   └── queries.py         # Blueprint: queries list, recheck
│   │   ├── services/pipeline.py   # orchestrator + response payload builder
│   │   ├── schemas/               # Pydantic: request bodies + agent output models
│   │   └── utils/
│   │       ├── scoring.py         # opportunity score (pure function)
│   │       └── responses.py       # ApiResponse: ok/created/paginated/error — sole response constructor
│   ├── tests/                     # test_scoring.py, test_agents.py, test_pipeline.py
│   ├── migrations/
│   ├── pyproject.toml             # uv
│   ├── Dockerfile                 # service owns its build
│   ├── .dockerignore
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/            # ProfileCard, QueryTable, ScoreBar, OpportunityCharts,
│   │   │                          # RecommendationCard, PipelineStatus, ErrorState, EmptyState,
│   │   │                          # layout/ (sidebar, theme toggle), ui/ (shadcn)
│   │   ├── pages/                 # Dashboard, CreateProfile, ProfileDetail (tabs: Queries/Recommendations/Runs)
│   │   ├── services/api.ts        # all fetch calls, typed; API_BASE_URL from env
│   │   ├── stores/                # Zustand micro-stores (complex pages only):
│   │   │                          #   queries-view.store.ts (filters/sort/pagination + actions)
│   │   │                          #   pipeline.store.ts (run trigger/status orchestration)
│   │   │                          #   theme.store.ts (dark mode, persisted)
│   │   ├── hooks/                 # useProfiles, useQueries, useRecommendations, useRunPipeline (poll)
│   │   ├── types/index.ts         # mirrors API payloads
│   │   └── lib/                   # shadcn utils
│   ├── .env.example               # VITE_API_BASE_URL=http://localhost:5000
│   ├── package.json               # pnpm
│   ├── Dockerfile                 # multi-stage: pnpm build → nginx:alpine
│   ├── .dockerignore
│   └── README.md
├── docker-compose.yml
├── CLAUDE.md                      # short: commands + hard conventions (response class, state rules, theming, 4 UI states)
├── README.md                      # overview + <5 min quickstart (docker + manual)
└── docs/
```

---

## 3. Backend design

### 3.1 Data models (SQLAlchemy, UUID string PKs, timestamps)

- **BusinessProfile** — uuid, name, domain, industry, description, competitors (JSON list), status, created_at, updated_at. Rel: runs, queries, recommendations.
- **PipelineRun** — uuid, profile_uuid FK, status (`pending|running|completed|failed`), queries_discovered, queries_scored, tokens_used, error_message, started_at, completed_at.
- **DiscoveredQuery** — uuid, profile_uuid FK, run_uuid FK, query_text, keyword (extracted seed keyword — schema addition, justified in README), intent (`transactional|commercial|informational` — addition), estimated_search_volume, competitive_difficulty, opportunity_score, domain_visible (nullable bool; NULL = unknown), visibility_position (nullable int), discovered_at.
- **ContentRecommendation** — uuid, profile_uuid FK, query_uuid FK, run_uuid FK (addition, for history), content_type, title, rationale, target_keywords (JSON), priority, created_at.

`?status=` filter maps: `visible`→True, `not_visible`→False, `unknown`→NULL.

### 3.2 Endpoints

| Method/Path | Behavior |
|---|---|
| `POST /api/v1/profiles` | Create profile (Pydantic-validated). 201 + spec response |
| `GET /api/v1/profiles` | List profiles + summary stats (needed by Dashboard; addition) |
| `GET /api/v1/profiles/{uuid}` | Profile + stats (total queries, avg opportunity score, last run) |
| `POST /api/v1/profiles/{uuid}/run` | **Sync default**: run pipeline, return spec-exact payload (run uuid, status, counts, top-3 queries, recommendations, tokens_used). **`?async=1`**: create run row (status=running), spawn thread, 202 `{run_uuid, status}`. Rate-limited (flask-limiter, e.g. 5/min) |
| `GET /api/v1/runs/{run_uuid}` | Run status; when completed, same payload as sync response (poll target) |
| `GET /api/v1/profiles/{uuid}/queries` | Sorted by score desc; `min_score`, `status`, `page`, `per_page`; returns items + pagination meta |
| `GET /api/v1/profiles/{uuid}/recommendations` | Per spec fields |
| `GET /api/v1/profiles/{uuid}/runs` | Run history list (needed by Runs tab; addition) |
| `POST /api/v1/queries/{query_uuid}/recheck` | Re-run Agent 2 scoring on one query; update row; return updated query |

**Responses:** every endpoint returns through `utils/responses.py::ApiResponse` — `.ok(data)`, `.created(data)`, `.paginated(items, page, per_page, total)`, `.error(code, message, status)`. Success bodies remain **bare/spec-shaped** (the brief's documented response bodies are unwrapped objects — a `{"success": true, "data": ...}` wrapper would visibly deviate when a reviewer curls the endpoints); list endpoints return `{items, pagination}`; errors return the consistent envelope `{"error": {"code": "...", "message": "..."}}`. Flask errorhandlers (400 validation, 404, 429, 500) route through the same class, so no response is hand-built anywhere. CORS via flask-cors (origin from env).

### 3.3 Agents

All Anthropic traffic through `agents/llm.py`:
- `generate_structured(system, user, schema: type[BaseModel], model) -> (BaseModel, Usage)` — `messages.parse()`, one retry on validation failure, then raises `AgentError` (callers degrade gracefully).
- `generate_text(system, user, model, max_tokens) -> (str, Usage)`.
- Token usage accumulated per run → `PipelineRun.tokens_used`.

**Agent 1 — QueryDiscoveryAgent** (Opus 4.8). System prompt: SEO/AEO strategist persona, constraints (commercially relevant, natural-language, mix of intents, 12–18 items), JSON schema spelled out. User template: name/domain/industry/description/competitors substituted. Output schema: `[{question, keyword, intent}]` — `keyword` = short priceable phrase for DataForSEO (long questions have no volume).

**Agent 2 — VisibilityScoringAgent** (Haiku 4.5 + DataForSEO):
1. One batched volume call + one batched difficulty call (all keywords).
2. Per query, in `ThreadPoolExecutor(max_workers=5)`: Haiku answers the raw question naturally (~600 max_tokens, no JSON) → deterministic scan of answer for target domain/brand + competitors (case-insensitive, domain and brand-name variants) → `domain_visible`, `visibility_position` = rank of target among first-mention order of all brands found.
3. Per-query try/except: any failure → `domain_visible=NULL` (status unknown), volume/difficulty defaults 0/50, run continues (**partial-failure requirement**).
4. `opportunity_score` from `utils/scoring.py`.
5. `recheck` reuses the same per-query path.

**Agent 3 — ContentRecommendationAgent** (Opus 4.8). Input: top ≤5 gap queries (highest score where not visible; fallback to lowest-visibility if all visible). Output schema: `[{target_query_uuid, content_type(enum: blog_post|landing_page|faq|comparison_page|guide), title, rationale, target_keywords, priority(enum)}]`. Prompt states persona, grounding rules (only provided queries, reference the gap), schema.

### 3.4 Opportunity score (README-documented)

```
score = 0.35·volume_n + 0.25·ease + 0.25·gap + 0.15·intent           ∈ [0, 1]
volume_n = min(1, log10(volume + 1) / 5)
ease     = 1 − difficulty/100
gap      = 1.0 (not visible) | 0.4 (visible, not first) | 0.0 (first mention)
intent   = 1.0 transactional/comparison | 0.7 commercial | 0.3 informational
unknown visibility → gap 0.7 (uncertain ≠ opportunity-free)
```

Rationale: demand-led weighting; gap and winnability co-equal; intent as tiebreaker. Pure function, unit-tested for ordering properties.

### 3.5 Cross-cutting

- **Logging:** stdlib, correlation ID = run_uuid on all pipeline log lines (bonus).
- **Rate limiting:** flask-limiter on the run endpoint only (bonus).
- **Config:** python-dotenv; `.env.example` per brief template + `DATAFORSEO_LOGIN/PASSWORD`, `CORS_ORIGINS`.
- **Tests (pytest, all external calls mocked):** scoring ordering/bounds; agent parse success + malformed→retry→graceful failure; pipeline partial failure (one probe raises → run completes, query marked unknown); one API smoke test (create profile → 201). Runnable without any API keys.

---

## 4. Frontend design

- **Data layer — two-tier state ownership:**
  - **TanStack Query = server state.** All fetching, caching, loading/error flags, and run-status polling. `services/api.ts` is the only fetch site.
  - **Zustand micro-stores = UI/business state** on pages with real logic. One small store per complex feature (not one global store): `queries-view.store.ts` (min-score, status filter, sort, page/per-page + actions that compose the query params), `pipeline.store.ts` (run-trigger orchestration state), `theme.store.ts`. Components consume stores via selectors and stay thin JSX; logic lives in store actions → unit-testable without rendering.
  - **Boundary rule (enforced):** server data is never copied into a Zustand store — stores hold parameters/UI state, TanStack Query holds data keyed by those parameters. Simple pages (Dashboard, Create form) use plain hooks — no store where `useState`/react-hook-form suffices.
  - Run trigger: `pipeline.store` action → mutation `?async=1` → poll `GET /runs/{uuid}` via `refetchInterval` until terminal → invalidate queries/recommendations/runs caches. PipelineStatus component shows live state (must-have #5).
- **Routing:** `/` Dashboard · `/profiles/new` · `/profiles/:uuid` (tabs: Queries default | Recommendations | Runs). Sidebar nav (must-have #7).
- **Component UI states (convention, enforced):** every data-driven view renders all four states — **loading** (shadcn Skeleton), **error** (friendly message + retry button), **empty** (guidance + CTA, e.g. "No queries yet — run the pipeline"), **filled**. Shared `ErrorState`/`EmptyState` components; TanStack Query supplies the flags. Loading/error are rubric must-haves; empty states are what makes it "feel like a real product" (brief's words).
- **Theming (single source of truth):** all colors + radius are semantic CSS variables in `src/index.css` — `:root` (light) and `.dark` blocks, per the shadcn convention (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--destructive`, `--border`, `--ring`, `--radius`, chart colors). Components use **only semantic utilities** (`bg-background`, `bg-primary`, `text-muted-foreground`, `border-border`, `rounded-lg`) — **never raw palette classes (`bg-blue-500`) or hex values in JSX**. Buttons/cards inherit from tokens (no separate `--button` var — that's what `--primary`/`--secondary` are). Result: a rebrand or theme change touches `index.css` only. **Spacing:** Tailwind's default scale is the spacing system — no custom spacing tokens (deliberate; consistency comes from reused layout components, e.g. cards always `p-6`).
- **Mutation feedback:** run/recheck/create surface success & error toasts (shadcn sonner) — actionable feedback is a UX rubric line.
- **Optimistic updates (rubric-named for full marks on state management):** Recheck instantly flips the row to a "checking…" state (rollback on error); Run instantly shows the pipeline as running before the first poll returns. Via TanStack Query `onMutate`/optimistic patterns — no extra machinery.
- **Screens:** per §Repo layout components; Queries table with min-score slider + status dropdown + sortable columns + score bar + per-row Recheck + pagination with page-size select (bonus).
- **Charts (must-have #4):** opportunity-score distribution (histogram/bar) + volume-vs-difficulty scatter (points colored by visibility) on Profile overview. Recharts via shadcn chart primitives; dataviz skill guidance at build time.
- **Dark mode** (bonus): shadcn CSS variables + toggle, persisted to localStorage.
- **Responsive:** desktop 1280px+ and tablet 768px+ (must-have #1); sidebar collapses on tablet.
- **Env:** `VITE_API_BASE_URL` (README notes deviation from the brief's CRA-era `REACT_APP_` prefix — CRA is deprecated; Vite is the current standard).
- **Tests (bonus):** 2–3 Vitest + Testing Library component tests (QueryTable filter behavior, ScoreBar rendering).
- **Figma:** pixel direction applied once user shares their duplicated file; until then shadcn defaults + clean B2B SaaS layout per brief.

---

## 5. Delivery

- **Docker — one Dockerfile per service, compose orchestrates only:**
  - `backend/Dockerfile` — official uv base image; `uv sync --frozen`; entry: `flask db upgrade && flask run --host 0.0.0.0`. Single stage (nothing to strip).
  - `frontend/Dockerfile` — **multi-stage**: node+pnpm build → `nginx:alpine` serving `dist/` (node_modules never ship). ⚠️ `VITE_API_BASE_URL` must be a **build ARG**, not a runtime env — Vite bakes env vars at build time.
  - `docker-compose.yml` — `build: ./backend` + `build: ./frontend`, SQLite named volume, `env_file: .env`, ports 5000 + 3000. No nginx→backend proxy: the brief explicitly requires flask-cors, so the frontend calls the API origin directly.
  - `.dockerignore` in both services (`.venv`, `node_modules`, `*.db`, `dist`).
  - Single `docker-compose up` from cold clone.
- **Manual path (also in README):** `cd backend && uv sync && uv run flask db upgrade && uv run flask run` · `cd frontend && pnpm install && pnpm dev`.
- **READMEs:** root (overview, quickstart both ways, env setup incl. DataForSEO trial signup), backend (architecture, agent design rationale, model selection reasoning, score formula, schema justification, tradeoffs, AI-tools disclosure per brief), frontend (stack choices, structure, component notes).
- **Submission:** git repo → GitHub (user pushes; repo not yet initialized — `git init` at implementation start).
- **User prerequisites:** Anthropic API key; DataForSEO account ($50 trial, no card).

## 6. Explicitly skipped (with reasons, also in README)

Celery/Redis (thread suffices) · Storybook (cost/benefit) · sparkline bonus (no score history on first run) · Postgres (equal grade, more cold-start risk) · WebSockets (polling satisfies must-have #5) · provider abstraction (one provider; centralized llm.py is the seam).

## 7. Rubric coverage map

**Task 1:** API design ✓ (§3.2) · Agent architecture ✓ (§3.3, partial failure) · Prompt engineering ✓ (§3.3, parse+prompt schema+fallback) · Data models ✓ (§3.1, migrations, UUID PKs) · Opportunity score ✓ (§3.4) · Code quality & testing ✓ (§3.5) · README ✓ (§5) · Bonus: async+polling, rate limiting, mocked unit tests, Pydantic validation, correlation-ID logging, Docker Compose.
**Task 2:** UI & components ✓ (§4) · Dashboard & dataviz ✓ (charts, live status) · API integration & state ✓ (TanStack Query + Zustand micro-stores, service layer) · UX workflow ✓ (profile→run→results with live feedback) · Code quality ✓ (TS, conventions) · Bonus: dark mode, pagination w/ size control, component tests, (animations if time permits).
