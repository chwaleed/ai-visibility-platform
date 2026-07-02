# AI Visibility Platform (Full Stack Assessment)

Flask API (Task 1) + React dashboard (Task 2). Brief: `docs/FullStack_Assessment.md`.
Design spec (read before structural changes): `docs/superpowers/specs/2026-07-03-ai-visibility-platform-design.md`.
Graded constraint: **simplicity beats over-engineering** — no new deps, layers, or abstractions without asking.

## Commands
- Backend (`backend/`): `uv sync` · `uv run flask db upgrade` · `uv run flask run` · `uv run pytest`
- Frontend (`frontend/`): `pnpm i` · `pnpm dev` · `pnpm test` · `pnpm build`
- Full stack: `docker-compose up` (per-service Dockerfiles; compose orchestrates only)

## Backend rules
- Every response goes through `app/utils/responses.py::ApiResponse` (`ok/created/paginated/error`) — never hand-build a response. Success bodies bare (spec-shaped); errors `{"error": {"code", "message"}}`.
- All Anthropic calls live in `app/agents/llm.py` only — agents/pipeline never import the SDK. Models: `claude-opus-4-8` (Agents 1 & 3, `messages.parse()` + Pydantic), `claude-haiku-4-5` (Agent 2 visibility probes, free text).
- Pipeline survives partial failures: per-query try/except → visibility `unknown`, run continues.
- Opportunity score is a pure function in `app/utils/scoring.py` — keep it unit-testable.
- Python type hints everywhere. Tests mock all external calls (must pass with no API keys).

## Frontend rules
- Fetches only in `services/api.ts`. Server state = TanStack Query; UI/business state = Zustand micro-stores (complex pages only). **Never copy server data into a store** — stores hold params/UI state, Query holds data.
- Every data view renders all 4 states: **loading** (Skeleton) / **error** (+retry) / **empty** (+CTA) / **filled**. Use shared `ErrorState`/`EmptyState`.
- Styling: only semantic tokens from `src/index.css` (`bg-background`, `bg-primary`, `text-muted-foreground`, `border-border`, `rounded-lg`). **Never raw palette classes (`bg-blue-500`) or hex in components.** Light + dark both defined in `index.css` — theme changes touch that file only. Spacing = Tailwind default scale (no custom tokens).
- TypeScript strict, no `any`. Mutations show sonner toasts.

## Git rules
- Commit directly on `main`. **Never add a Co-Authored-By trailer (no AI attribution in commits).** Never push unless asked.
- Conventional commit subjects (`feat(backend): ...`, `test: ...`, `chore: ...`).

## Env (never commit real keys)
- Backend `.env`: `ANTHROPIC_API_KEY`, `SERANKING_API_KEY`, `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`
- Frontend `.env`: `VITE_API_BASE_URL` (build ARG in Docker — Vite bakes it at build time)
