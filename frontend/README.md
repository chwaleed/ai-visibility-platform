# Frontend — AI Visibility Dashboard (Task 2)

The React dashboard for the AI Visibility Platform: register a business profile, trigger the 3-agent pipeline with live status, and explore discovered queries (real volume/difficulty, opportunity scores), visibility, content recommendations, run history, and charts.

Talks to the Flask API (Task 1) — see the [root README](../README.md) and [`backend/`](../backend/README.md).

## Stack — and why (framework + component library choice, per brief)

| Choice | Why |
|---|---|
| **React 19 + Vite + TypeScript (strict)** | Functional components + hooks; `strict` and no-`any` catch contract drift against the API at compile time |
| **Tailwind v4 + shadcn/ui** (base-ui variant) | Semantic-token theming; we own the component source — no black-box UI kit |
| **TanStack Query** | Server state: caching, background refetch, polling. The one source of truth for API data |
| **Zustand micro-stores** | UI/business state only (query filters). **Never holds server data** |
| **axios** | Single configured client with one error→`ApiError` mapping |
| **recharts** | Charts through shadcn `Chart*` wrappers, colored only by `--chart-N` tokens |
| **react-hook-form** | Native validation rules on the create form — no schema-resolver layer for 5 fields |

## Setup

```bash
pnpm i
cp .env.example .env      # VITE_API_BASE_URL — defaults to http://localhost:5000
pnpm dev                  # http://localhost:5173
pnpm test                 # vitest
pnpm build                # tsc -b + vite build (type-checks the whole app)
```

> **`VITE_API_BASE_URL`, not `REACT_APP_API_BASE_URL`.** The brief's example uses the CRA prefix; this app is Vite, which only exposes `VITE_`-prefixed vars. Vite **bakes the value in at build time** — in Docker it's a build `ARG`, not a runtime env var.

## Architecture

### Data flow — one boundary, two kinds of state

```
component → hook (TanStack Query) → services/api.ts (axios) → Flask API
                    ↑
        stores/queryFilters.ts (Zustand: minScore, status, page, perPage)
```

- **`services/api.ts` is the only network boundary.** One axios instance; every failure maps to a typed `ApiError` carrying the backend's `{error: {code, message}}` envelope (network failures → `network_error`). Components and hooks never call fetch/axios directly.
- **One hook per resource:** `useProfiles`, `useProfile`, `useQueries`, `useRuns`, `useRecommendations`, plus mutations `useCreateProfile` (toast → invalidate → redirect) and `useRecheck` (per-row in-flight set).
- **Server data never enters a store.** Zustand holds filter/pagination params only; changing any filter resets `page` to 1 — that business rule lives in the store and is unit-tested.

### Pipeline trigger + live status (`hooks/usePipeline.ts`)

`trigger` POSTs `/run?async=1` (202 + run uuid) and optimistically shows the running state. A Query with `refetchInterval` polls `GET /runs/<uuid>` every 2 s until the status is terminal, then invalidates profile/queries/recommendations/runs caches and toasts once. On page refresh, the hook resumes polling if the latest run is still `running` — the banner survives reloads.

### Routing & screens

| Route | Screen |
|---|---|
| `/` | Dashboard — summary stat row + profile cards (queries, avg score, opportunity bar, last-run status) |
| `/profiles/new` | Create Profile — validated form (name, domain pattern, industry select, competitors tag input, ≤10) |
| `/profiles/:uuid` | Profile Detail — header + Run Pipeline button, live 4-step progress banner, 4 KPI cards, tabs: **Overview** (score histogram, volume/difficulty scatter, visibility breakdown) · **Queries** (filterable table: min-score slider + status select, score bars, per-row recheck, numbered pagination with page-size control) · **Recommendations** (priority-filterable table with expandable rationale/keywords, paginated) · **Runs** (history with duration + tokens) |
| `*` | 404 |

### Layout & responsiveness

Desktop (`lg+`): sticky sidebar rail — brand, navigation, live profile list. Below `lg`: a top bar with a hamburger that opens the same nav in a slide-in drawer (base-ui Sheet); it closes on navigation or backdrop tap. Content grids collapse 4→2→1 columns; tables scroll horizontally inside their cards; the pipeline stepper drops text labels on mobile (compact circles + connectors). Works at the brief's 1280px+ and 768px+ targets, and below.

### Four states, everywhere

Every data view renders **loading** (Skeleton) / **error** (shared `ErrorState` + retry) / **empty** (shared `EmptyState` + CTA) / **filled**. No view assumes success.

### Theming

All color/radius comes from semantic tokens in `src/index.css` (light + dark, dark mode toggle in the sidebar). Components carry no raw palette classes and no hex — the design was matched by retuning the token layer, so a theme change touches one file. Charts use only `--chart-N` tokens.

## Component inventory

`components/` — `ProfileCard`, `StatCard`, `StatusBadge`/`Pill` (tone-mapped), `PipelineStatus` (running stepper / completed / failed / no-run banners), `QueryFilters`, `QueryTable`, `ScoreBar`, `PaginationControls` (numbered pager + page-size select), `RunsTable`, `CompetitorsInput`, `charts/ScoreDistribution`, `charts/VolumeDifficultyScatter`, shared `states/`, and the shadcn `ui/` primitives actually in use — unused ones are deleted, not kept "just in case".

## Testing

Covered with vitest + Testing Library: the API client (success parse, error-envelope → `ApiError`, query-string building, network-failure mapping), the query-filters store (defaults + page-reset rules), and shared primitives (`ScoreBar`, `ErrorState`/`EmptyState`). Tests mock the API client — no backend needed.

## Docker

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:5000 -t ai-visibility-web .
docker run -p 3000:80 ai-visibility-web        # http://localhost:3000
```

Multi-stage: Node builds the static bundle, nginx serves it with SPA fallback (`nginx.conf`). Because Vite inlines env at build time, point the app at a different API by changing the build arg — a runtime env var has no effect. `docker compose up` from the repo root wires this alongside the backend.

**Production (`docker-compose.prod.yml` + the deploy workflow):** only the frontend is published to the host. The image is built with an **empty** `VITE_API_BASE_URL`, so the app calls `/api/v1` on its own origin and nginx proxies `/api/` to the `backend` service over the compose network (runtime DNS resolver, 300 s read timeout for long sync runs). Side benefit: same-origin requests make CORS a non-issue in production.
