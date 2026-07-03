# AI Visibility Dashboard (Task 2)

The React dashboard for the AI Visibility Platform. Register a business profile, trigger
the 3-agent pipeline, and explore the results: discovered queries with real volume/difficulty
and opportunity scores, whether the domain shows up in AI answers, content recommendations,
run history, and charts of the opportunity landscape.

Talks to the Flask API (Task 1) — see the [root README](../README.md) and [`backend/`](../backend).

## Stack — and why

| Choice | Why |
|---|---|
| **React + Vite + TypeScript (strict)** | Fast dev/build; `strict` + `no any` catch contract drift against the API |
| **Tailwind v4 + shadcn/ui** | Semantic-token theming; own the component source, no black-box UI kit |
| **TanStack Query** | Server state — caching, background refetch, polling. The one source of truth for API data |
| **Zustand micro-stores** | UI/business state only (query filters). **Never holds server data** — that stays in Query |
| **axios** | Single configured client in `services/api.ts` with one error→`ApiError` mapping |
| **recharts** | Charts via shadcn's `Chart*` wrappers, colored only by `--chart-N` theme tokens |

## Setup

```bash
pnpm i
cp .env.example .env      # VITE_API_BASE_URL — defaults to http://localhost:5000
pnpm dev                  # http://localhost:5173
```

> **`VITE_API_BASE_URL`, not `REACT_APP_API_URL`.** The brief's example uses the Create-React-App
> `REACT_APP_` prefix; this app is Vite, which exposes only `VITE_`-prefixed vars via `import.meta.env`.
> Vite **bakes it in at build time**, so in Docker it's a build `ARG`, not a runtime env var.

## Architecture

- **One network boundary.** Every request lives in `src/services/api.ts` (one axios instance,
  one `ApiError` envelope). Components and hooks never call `fetch`/`axios` directly.
- **A hook per resource.** `useProfiles`, `useProfile`, `useQueries`, `useRuns`,
  `useRecommendations`, plus mutations (`useCreateProfile`, `useRecheck`) and `usePipeline`
  (triggers a run and polls it every 2s until terminal, then invalidates affected caches).
- **Four states everywhere.** Every data view renders **loading** (Skeleton) / **error**
  (+retry) / **empty** (+CTA) / **filled** via shared `ErrorState`/`EmptyState`.
- **Token-only theming.** All colour/radius comes from semantic tokens in `src/index.css`
  (light + dark). Changing the theme touches that one file — components carry no raw palette classes.
- **Filters live in a store, not the URL/data.** `stores/queryFilters.ts` holds min-score,
  status, page, page-size. The business rule (any filter change resets to page 1) lives in the store.

## Screens

- **Dashboard** — profile cards with per-profile stats (queries, avg score, last run).
- **Create Profile** — validated form (react-hook-form) with a competitors tag input.
- **Profile detail** — header + Run Pipeline (live status), and four tabs:
  - **Overview** — opportunity-score histogram + volume/difficulty scatter (colored by visibility).
  - **Queries** — filterable, paginated table with per-row visibility recheck.
  - **Recommendations** — grouped High → Medium → Low.
  - **Runs** — pipeline run history with duration and token usage.

## Testing

```bash
pnpm test     # vitest
pnpm build    # tsc -b + vite build (type-checks the whole app)
```

Covered: the API client (success parse, error-envelope → `ApiError`, query-string omission,
network-failure mapping), the query-filters store (defaults + page-reset rules), and shared
primitives. Tests mock the API client — no backend needed.

## Docker

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:5000 -t ai-visibility-web .
docker run -p 3000:80 ai-visibility-web        # http://localhost:3000
```

Multi-stage: Node builds the static bundle, nginx serves it (SPA fallback in `nginx.conf`).
Because Vite inlines env at build time, point the app at a different API by passing
`--build-arg VITE_API_BASE_URL=...` — a runtime env var has no effect. `docker compose up`
from the repo root wires this alongside the backend.
