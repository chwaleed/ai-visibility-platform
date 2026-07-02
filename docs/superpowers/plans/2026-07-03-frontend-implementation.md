# AI Visibility Dashboard (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Task 2 — the React dashboard over the completed Flask API: profile management, pipeline trigger with live polling, filterable queries table, recommendations, run history, charts, dark mode.

**Architecture:** Vite + React + TS strict. Server state lives ONLY in TanStack Query; UI/business state in Zustand micro-stores (complex pages only); all fetches in `services/api.ts`. Every data view renders 4 states (loading/error/empty/filled). All colors/radius are semantic tokens in `src/index.css` (light+dark) — no raw palette classes in components.

**Tech Stack:** pnpm · Vite · React · TypeScript (strict) · Tailwind v4 + shadcn/ui · TanStack Query v5 · react-router v7 · Zustand · Recharts (via shadcn charts) · react-hook-form + zod · sonner · Vitest + Testing Library.

**Figma note:** the linked Figma is inspiration-only (user's words) and is access-blocked for tooling. Visual direction: clean B2B analytics dashboard — collapsible sidebar, stat cards, data table, violet primary, emerald/amber/red status accents. All of it lives in `index.css` tokens, so later reconciliation with Figma touches one file.

## Global Constraints

- Package manager: **pnpm only**. Working dir for all commands: `d:\Assment\frontend` unless stated.
- **Fetches only in `src/services/api.ts`.** Components/hooks never call `fetch` directly.
- **Never copy server data into a Zustand store** — stores hold filters/UI state only.
- Every data view: **loading (Skeleton) / error (ErrorState + retry) / empty (EmptyState + CTA) / filled**.
- Styling: **only semantic tokens** (`bg-background`, `bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`, chart vars). **Never `bg-blue-500`-style classes or hex in components.** Spacing = Tailwind default scale.
- TypeScript strict; **no `any`** (use `unknown` + narrowing where needed).
- Mutations show sonner toasts. Errors show the API's `error.message`.
- Backend API contract (source of truth — mirrors the shipped `to_dict()`s) is defined in Task 2's `types/index.ts`; do not invent fields.
- Commit on `main` after every task, conventional subjects (`feat(frontend): ...`). **NEVER add a Co-Authored-By trailer or any AI attribution.** Never push.
- `pnpm test` and `pnpm build` must pass at every commit.
- shadcn-generated files under `src/components/ui/` are CLI output — never hand-edit them (except `index.css` tokens).

---

### Task 0: Scaffold — Vite + Tailwind v4 + shadcn + Vitest

**Files:**
- Create: `frontend/` project via CLIs, `frontend/.env.example`, `frontend/.env`, `frontend/src/setupTests.ts`
- Modify: `frontend/vite.config.ts`, `frontend/package.json` (scripts), `frontend/tsconfig.json` (paths)

**Interfaces:**
- Produces: running dev server; `@/` path alias; `pnpm test` harness; shadcn CLI ready (`components.json`).

- [ ] **Step 1: Create the Vite app** (from `d:\Assment`)

```bash
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
```

- [ ] **Step 2: Tailwind v4 + path alias**

```bash
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D @types/node
```

Replace `frontend/vite.config.ts`:
```ts
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

Replace `frontend/src/index.css` content with a single line for now (tokens land in Task 1):
```css
@import "tailwindcss";
```

In `frontend/tsconfig.json` add to `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```
(Also add the same `baseUrl`/`paths` to `tsconfig.app.json`'s compilerOptions — Vite templates split configs; shadcn reads both.)

- [ ] **Step 3: shadcn init + core components**

```bash
pnpm dlx shadcn@latest init
```
Choose defaults (style: new-york, base color: neutral, CSS variables: yes). If prompted for the css file: `src/index.css`. Then:

```bash
pnpm dlx shadcn@latest add button card input label badge table tabs skeleton sonner select slider dialog form separator sheet tooltip dropdown-menu chart sidebar breadcrumb
```

(If any component name is rejected by the CLI, install the rest and note it in your report — do not hand-write substitutes.)

- [ ] **Step 4: App dependencies + Vitest**

```bash
pnpm add @tanstack/react-query react-router zustand recharts react-hook-form zod @hookform/resolvers
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

`frontend/src/setupTests.ts`:
```ts
import "@testing-library/jest-dom/vitest"
```

Append to `frontend/vite.config.ts` inside `defineConfig({...})` (Vitest reads it):
```ts
  // @ts-expect-error vitest config in vite config
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
```

`package.json` scripts — ensure:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "lint": "eslint ."
}
```

- [ ] **Step 5: Env files**

`frontend/.env.example`:
```env
# Backend API origin (the brief shows CRA-era REACT_APP_*; this project uses Vite,
# whose convention is VITE_* — noted in README)
VITE_API_BASE_URL=http://localhost:5000
```
Copy to `frontend/.env` unchanged.

- [ ] **Step 6: Clean template cruft**

Delete `src/App.css`, `src/assets/react.svg`, `public/vite.svg` references. Replace `src/App.tsx` with:
```tsx
export default function App() {
  return <div className="p-8 text-2xl font-semibold">AI Visibility</div>
}
```
Remove the `import './App.css'` and logo code from `main.tsx` if present (keep `index.css` import).

- [ ] **Step 7: Verify**

Run: `pnpm build` — Expected: succeeds. Run: `pnpm test` — Expected: "no test files found" exit 0 (or configure `passWithNoTests: true` in the test block if vitest exits non-zero). Run `pnpm dev` briefly — page renders.

- [ ] **Step 8: Commit**

`git add frontend && git commit -m "feat(frontend): scaffold — Vite, Tailwind v4, shadcn, Vitest"`

---

### Task 1: Design tokens, theme toggle, app shell, routes

**Files:**
- Modify: `frontend/src/index.css` (brand token block), `frontend/src/App.tsx`, `frontend/src/main.tsx`
- Create: `frontend/src/components/layout/ThemeProvider.tsx`, `frontend/src/components/layout/ThemeToggle.tsx`, `frontend/src/components/layout/AppShell.tsx`, `frontend/src/pages/Dashboard.tsx` (stub), `frontend/src/pages/CreateProfile.tsx` (stub), `frontend/src/pages/ProfileDetail.tsx` (stub)

**Interfaces:**
- Produces: `<AppShell>` layout route wrapping all pages (sidebar + header + `<Outlet/>`); `useTheme()` hook; routes `/`, `/profiles/new`, `/profiles/:uuid`; `<Toaster/>` mounted.

- [ ] **Step 1: Brand tokens.** shadcn init generated `:root`/`.dark` variable blocks in `index.css`. OVERRIDE (replace values, keep structure/names) so both themes are deliberate. Set in `:root`: `--primary: oklch(0.55 0.22 285)` (violet), `--primary-foreground: oklch(0.985 0 0)`, `--ring: oklch(0.55 0.22 285)`, `--chart-1: oklch(0.55 0.22 285)`, `--chart-2: oklch(0.65 0.17 160)` (emerald), `--chart-3: oklch(0.75 0.16 75)` (amber), `--chart-4: oklch(0.62 0.21 25)` (red), `--chart-5: oklch(0.6 0.05 260)` (slate), `--radius: 0.5rem`. In `.dark`: `--primary: oklch(0.62 0.2 285)`, same chart hues bumped ~+0.05 lightness. Keep all other generated neutrals as-is. Add two app-status tokens to BOTH blocks and register them in the `@theme inline` section so `text-success`/`text-warning` utilities exist:
```css
:root { --success: oklch(0.60 0.15 160); --warning: oklch(0.70 0.15 75); }
.dark { --success: oklch(0.70 0.15 160); --warning: oklch(0.78 0.15 75); }
@theme inline { --color-success: var(--success); --color-warning: var(--warning); }
```

- [ ] **Step 2: ThemeProvider + toggle**

`frontend/src/components/layout/ThemeProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme | null) ?? "light",
  )
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("theme", theme)
  }, [theme])
  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")) }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext)
```

`frontend/src/components/layout/ThemeToggle.tsx`:
```tsx
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "./ThemeProvider"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
```

- [ ] **Step 3: AppShell with shadcn sidebar**

`frontend/src/components/layout/AppShell.tsx`:
```tsx
import { LayoutDashboard, Plus, Radar } from "lucide-react"
import { Link, Outlet, useLocation } from "react-router"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./ThemeToggle"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles/new", label: "New Profile", icon: Plus },
]

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Radar className="size-5 text-primary" />
            <span className="font-semibold group-data-[collapsible=icon]:hidden">
              AI Visibility
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname === item.to}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 4: Router + providers**

`frontend/src/App.tsx`:
```tsx
import { Route, Routes } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import CreateProfile from "@/pages/CreateProfile"
import Dashboard from "@/pages/Dashboard"
import ProfileDetail from "@/pages/ProfileDetail"

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profiles/new" element={<CreateProfile />} />
        <Route path="/profiles/:uuid" element={<ProfileDetail />} />
      </Route>
    </Routes>
  )
}
```

`frontend/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import App from "./App"
import { ThemeProvider } from "./components/layout/ThemeProvider"
import { Toaster } from "./components/ui/sonner"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
```

Page stubs (all three, same pattern):
```tsx
export default function Dashboard() {
  return <h1 className="text-2xl font-semibold">Dashboard</h1>
}
```

- [ ] **Step 5: Verify + commit**

`pnpm build` green; `pnpm dev` → sidebar renders, toggle flips dark class, routes navigate.
`git add frontend && git commit -m "feat(frontend): tokens, theme toggle, sidebar shell, routes"`

---

### Task 2: API contract — types + service layer (+ tests)

**Files:**
- Create: `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- Test: `frontend/src/services/api.test.ts`

**Interfaces:**
- Produces (consumed by every hook): all API types; `ApiError` class (`code`, `message`, `details?`, `status`); `api` object with typed methods: `listProfiles()`, `getProfile(uuid)`, `createProfile(body)`, `runPipelineAsync(uuid)`, `getRun(runUuid)`, `listRuns(uuid)`, `listQueries(uuid, params)`, `recheckQuery(queryUuid)`, `listRecommendations(uuid)`.

- [ ] **Step 1: Types** — `frontend/src/types/index.ts`:

```ts
export type Intent = "transactional" | "commercial" | "informational"
export type VisibilityStatus = "visible" | "not_visible" | "unknown"
export type RunStatus = "running" | "completed" | "failed" | "pending"
export type Priority = "high" | "medium" | "low"
export type ContentType =
  | "blog_post" | "landing_page" | "faq" | "comparison_page" | "guide"

export interface Profile {
  profile_uuid: string
  name: string
  domain: string
  industry: string
  description: string
  competitors: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface ProfileStats {
  total_queries: number
  avg_opportunity_score: number | null
  last_run_status: string | null
  last_run_at: string | null
}

export type ProfileWithStats = Profile & ProfileStats

export interface ProfileCreated {
  profile_uuid: string
  name: string
  domain: string
  status: string
  created_at: string
}

export interface ProfileCreateBody {
  name: string
  domain: string
  industry: string
  description: string
  competitors: string[]
}

export interface DiscoveredQuery {
  query_uuid: string
  profile_uuid: string
  run_uuid: string
  query_text: string
  keyword: string
  intent: Intent
  estimated_search_volume: number
  competitive_difficulty: number
  opportunity_score: number
  domain_visible: boolean | null
  visibility_position: number | null
  status: VisibilityStatus
  discovered_at: string
}

export interface Recommendation {
  recommendation_uuid: string
  target_query_uuid: string
  run_uuid: string
  content_type: ContentType
  title: string
  rationale: string
  target_keywords: string[]
  priority: Priority
  created_at: string
}

export interface PipelineRun {
  run_uuid: string
  profile_uuid: string
  status: RunStatus
  queries_discovered: number
  queries_scored: number
  tokens_used: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface RunPayload extends PipelineRun {
  top_queries: DiscoveredQuery[]
  recommendations: Recommendation[]
}

export interface RunAccepted {
  run_uuid: string
  status: "running"
  poll: string
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

export interface QueryListParams {
  min_score?: number
  status?: VisibilityStatus
  page?: number
  per_page?: number
}
```

- [ ] **Step 2: Failing tests** — `frontend/src/services/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, api } from "./api"

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ))
}

afterEach(() => vi.unstubAllGlobals())

describe("api client", () => {
  it("returns parsed JSON on success", async () => {
    mockFetchOnce({ items: [] })
    const res = await api.listProfiles()
    expect(res.items).toEqual([])
  })

  it("throws ApiError with backend code/message on error envelope", async () => {
    mockFetchOnce({ error: { code: "not_found", message: "Profile x not found" } }, 404)
    const err = await api.getProfile("x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe("not_found")
    expect((err as ApiError).message).toBe("Profile x not found")
    expect((err as ApiError).status).toBe(404)
  })

  it("builds query strings from params, omitting undefined", async () => {
    mockFetchOnce({ items: [], pagination: { page: 2, per_page: 10, total: 0, total_pages: 1 } })
    await api.listQueries("p1", { min_score: 0.5, page: 2, per_page: 10 })
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain("/api/v1/profiles/p1/queries?")
    expect(url).toContain("min_score=0.5")
    expect(url).toContain("page=2")
    expect(url).not.toContain("status=")
  })

  it("wraps network failures in ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed") }))
    const err = await api.listProfiles().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe("network_error")
  })
})
```

- [ ] **Step 3: Run to verify failure** — `pnpm test` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement** — `frontend/src/services/api.ts`:

```ts
import type {
  DiscoveredQuery, Paginated, PipelineRun, Profile, ProfileCreateBody,
  ProfileCreated, ProfileStats, ProfileWithStats, QueryListParams,
  Recommendation, RunAccepted, RunPayload,
} from "@/types"

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"}/api/v1`

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    })
  } catch {
    throw new ApiError("network_error", "Could not reach the API — is the backend running?", 0)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error
    throw new ApiError(
      err?.code ?? "unknown_error",
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details,
    )
  }
  return body as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (!entries.length) return ""
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`
}

export const api = {
  listProfiles: () => request<{ items: ProfileWithStats[] }>("/profiles"),
  getProfile: (uuid: string) => request<Profile & ProfileStats>(`/profiles/${uuid}`),
  createProfile: (body: ProfileCreateBody) =>
    request<ProfileCreated>("/profiles", { method: "POST", body: JSON.stringify(body) }),
  runPipelineAsync: (uuid: string) =>
    request<RunAccepted>(`/profiles/${uuid}/run?async=1`, { method: "POST" }),
  getRun: (runUuid: string) => request<RunPayload>(`/runs/${runUuid}`),
  listRuns: (uuid: string) => request<{ items: PipelineRun[] }>(`/profiles/${uuid}/runs`),
  listQueries: (uuid: string, params: QueryListParams = {}) =>
    request<Paginated<DiscoveredQuery>>(`/profiles/${uuid}/queries${qs(params)}`),
  recheckQuery: (queryUuid: string) =>
    request<DiscoveredQuery>(`/queries/${queryUuid}/recheck`, { method: "POST" }),
  listRecommendations: (uuid: string) =>
    request<{ items: Recommendation[] }>(`/profiles/${uuid}/recommendations`),
}
```

- [ ] **Step 5: Run tests** — `pnpm test` — Expected: 4 passed. `pnpm build` green.
- [ ] **Step 6: Commit** — `git add frontend && git commit -m "feat(frontend): typed API contract + service layer with error envelope"`

---

### Task 3: Shared primitives — states, badges, score bar (+ tests)

**Files:**
- Create: `frontend/src/components/states/ErrorState.tsx`, `frontend/src/components/states/EmptyState.tsx`, `frontend/src/components/StatusBadge.tsx`, `frontend/src/components/ScoreBar.tsx`
- Test: `frontend/src/components/ScoreBar.test.tsx`, `frontend/src/components/states/states.test.tsx`

**Interfaces:**
- Produces: `<ErrorState message onRetry?>`, `<EmptyState title description? action?>`, `<StatusBadge status>` (visible=success, not_visible=destructive, unknown=muted; also accepts run statuses: completed=success, failed=destructive, running=warning-pulse), `<ScoreBar score>` (0–1 → % bar + numeric label).

- [ ] **Step 1: Failing tests**

`frontend/src/components/ScoreBar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ScoreBar } from "./ScoreBar"

describe("ScoreBar", () => {
  it("renders the numeric score and a proportional bar", () => {
    render(<ScoreBar score={0.73} />)
    expect(screen.getByText("0.73")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0.73")
  })
  it("clamps out-of-range scores", () => {
    render(<ScoreBar score={1.4} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
  })
})
```

`frontend/src/components/states/states.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EmptyState } from "./EmptyState"
import { ErrorState } from "./ErrorState"

describe("state components", () => {
  it("ErrorState shows message and fires retry", async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Boom" onRetry={onRetry} />)
    expect(screen.getByText("Boom")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
  it("EmptyState renders title and action", () => {
    render(<EmptyState title="No queries yet" action={<button>Run pipeline</button>} />)
    expect(screen.getByText("No queries yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /run pipeline/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** — `pnpm test` — Expected: new tests FAIL.

- [ ] **Step 3: Implement**

`frontend/src/components/states/ErrorState.tsx`:
```tsx
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
```

`frontend/src/components/states/EmptyState.tsx`:
```tsx
import { Inbox } from "lucide-react"

export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
```

`frontend/src/components/StatusBadge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STYLES: Record<string, string> = {
  visible: "bg-success/15 text-success border-success/30",
  not_visible: "bg-destructive/15 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground border-border",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  running: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  pending: "bg-muted text-muted-foreground border-border",
  created: "bg-muted text-muted-foreground border-border",
  analyzed: "bg-success/15 text-success border-success/30",
}

const LABELS: Record<string, string> = {
  visible: "Visible",
  not_visible: "Not visible",
  unknown: "Unknown",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", STYLES[status] ?? STYLES.unknown)}>
      {LABELS[status] ?? status}
    </Badge>
  )
}
```

`frontend/src/components/ScoreBar.tsx`:
```tsx
export function ScoreBar({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 1)
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        className="h-2 w-20 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className="text-sm tabular-nums text-muted-foreground">{clamped.toFixed(2)}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run** — `pnpm test` — Expected: all pass. `pnpm build` green.
- [ ] **Step 5: Commit** — `git add frontend && git commit -m "feat(frontend): shared state components, status badge, score bar"`

---

### Task 4: Dashboard — profiles list

**Files:**
- Create: `frontend/src/hooks/useProfiles.ts`, `frontend/src/components/ProfileCard.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `api.listProfiles`, shared primitives.
- Produces: `useProfiles()` (TanStack Query, key `["profiles"]`); Dashboard page with 4 states.

- [ ] **Step 1: Hook** — `frontend/src/hooks/useProfiles.ts`:
```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles })
}
```

- [ ] **Step 2: ProfileCard** — `frontend/src/components/ProfileCard.tsx`:
```tsx
import { Link } from "react-router"
import { StatusBadge } from "@/components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfileWithStats } from "@/types"

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}

export function ProfileCard({ profile }: { profile: ProfileWithStats }) {
  return (
    <Link to={`/profiles/${profile.profile_uuid}`} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{profile.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{profile.domain}</p>
          </div>
          {profile.last_run_status && <StatusBadge status={profile.last_run_status} />}
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          <Stat label="Industry" value={<span className="line-clamp-1">{profile.industry}</span>} />
          <Stat label="Queries" value={profile.total_queries} />
          <Stat
            label="Avg score"
            value={profile.avg_opportunity_score?.toFixed(2) ?? "—"}
          />
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 3: Dashboard page** — `frontend/src/pages/Dashboard.tsx`:
```tsx
import { Plus } from "lucide-react"
import { Link } from "react-router"
import { ProfileCard } from "@/components/ProfileCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"

export default function Dashboard() {
  const { data, isPending, isError, error, refetch } = useProfiles()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Business Profiles</h1>
        <Button asChild>
          <Link to="/profiles/new"><Plus className="size-4" /> New Profile</Link>
        </Button>
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      )}

      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No profiles yet"
          description="Register a business to discover how visible it is in AI answers."
          action={
            <Button asChild>
              <Link to="/profiles/new"><Plus className="size-4" /> Create your first profile</Link>
            </Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map(p => <ProfileCard key={p.profile_uuid} profile={p} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify** — `pnpm test && pnpm build` green. With backend running (`uv run flask --app app run` in backend/): `pnpm dev`, Dashboard shows empty state (or seeded profiles), error state when backend stopped.
- [ ] **Step 5: Commit** — `git add frontend && git commit -m "feat(frontend): dashboard with profile cards + 4 states"`

---

### Task 5: Create Profile form

**Files:**
- Create: `frontend/src/hooks/useCreateProfile.ts`, `frontend/src/components/CompetitorsInput.tsx`
- Modify: `frontend/src/pages/CreateProfile.tsx`

**Interfaces:**
- Consumes: `api.createProfile`, shadcn form components.
- Produces: form with zod validation; on success → toast + navigate to `/profiles/:uuid` + invalidate `["profiles"]`.

- [ ] **Step 1: Mutation hook** — `frontend/src/hooks/useCreateProfile.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"
import type { ProfileCreateBody } from "@/types"

export function useCreateProfile() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (body: ProfileCreateBody) => api.createProfile(body),
    onSuccess: created => {
      void queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success(`Profile "${created.name}" created`)
      void navigate(`/profiles/${created.profile_uuid}`)
    },
    onError: (err: ApiError) => toast.error(err.message),
  })
}
```

- [ ] **Step 2: Competitors tag input** — `frontend/src/components/CompetitorsInput.tsx`:
```tsx
import { X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export function CompetitorsInput({
  value, onChange,
}: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("")

  function commit() {
    const domain = draft.trim().toLowerCase()
    if (domain && !value.includes(domain)) onChange([...value, domain])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        placeholder="competitor.com — press Enter to add"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(c => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                onClick={() => onChange(value.filter(v => v !== c))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Page** — `frontend/src/pages/CreateProfile.tsx`:
```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CompetitorsInput } from "@/components/CompetitorsInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useCreateProfile } from "@/hooks/useCreateProfile"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  domain: z
    .string()
    .min(3, "Domain is required")
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a bare domain like example.com"),
  industry: z.string().min(1, "Industry is required").max(255),
  description: z.string().max(2000).default(""),
  competitors: z.array(z.string()).max(10, "At most 10 competitors"),
})
type FormValues = z.infer<typeof schema>

export default function CreateProfile() {
  const create = useCreateProfile()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", domain: "", industry: "", description: "", competitors: [] },
  })

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Register a business profile</CardTitle>
          <CardDescription>
            The pipeline discovers what people ask AI assistants in this space and whether
            this domain shows up in the answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(values => create.mutate(values))}
            >
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl><Input placeholder="Frase" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="domain" render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl><Input placeholder="frase.io" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl><Input placeholder="SEO Content Tools" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="AI-powered content briefs" {...field} /></FormControl>
                  <FormDescription>Optional — helps the discovery agent.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="competitors" render={({ field }) => (
                <FormItem>
                  <FormLabel>Competitors</FormLabel>
                  <FormControl>
                    <CompetitorsInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={create.isPending} className="w-full">
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Create profile
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Verify** — `pnpm test && pnpm build` green; manual: create a profile against the live backend → toast → redirected to detail stub; validation errors render under fields.
- [ ] **Step 5: Commit** — `git add frontend && git commit -m "feat(frontend): create-profile form with zod validation + competitors input"`

---

### Task 6: Profile detail shell — stats, tabs, Run Pipeline with live polling

**Files:**
- Create: `frontend/src/hooks/useProfile.ts`, `frontend/src/hooks/usePipeline.ts`, `frontend/src/components/PipelineStatus.tsx`
- Modify: `frontend/src/pages/ProfileDetail.tsx`

**Interfaces:**
- Consumes: `api.getProfile`, `api.runPipelineAsync`, `api.getRun`, `api.listRuns`.
- Produces: `useProfile(uuid)` (key `["profile", uuid]`); `usePipeline(profileUuid)` returning `{ trigger, isTriggering, activeRun, isRunning }` — polls `["run", runUuid]` every 2s until terminal, then invalidates `profile/queries/recommendations/runs` keys and toasts; `<PipelineStatus run>`; ProfileDetail page with header + tab slots (tab CONTENT lands in Tasks 7–10; render placeholders now).

- [ ] **Step 1: Hooks**

`frontend/src/hooks/useProfile.ts`:
```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useProfile(uuid: string) {
  return useQuery({ queryKey: ["profile", uuid], queryFn: () => api.getProfile(uuid) })
}
```

`frontend/src/hooks/usePipeline.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"
import type { RunPayload } from "@/types"

const TERMINAL = new Set(["completed", "failed"])

export function usePipeline(profileUuid: string) {
  const queryClient = useQueryClient()
  const [activeRunUuid, setActiveRunUuid] = useState<string | null>(null)

  // Resume polling after a page refresh if the latest run is still running.
  const runsQuery = useQuery({
    queryKey: ["runs", profileUuid],
    queryFn: () => api.listRuns(profileUuid),
  })
  useEffect(() => {
    const latest = runsQuery.data?.items[0]
    if (!activeRunUuid && latest && latest.status === "running") {
      setActiveRunUuid(latest.run_uuid)
    }
  }, [runsQuery.data, activeRunUuid])

  const trigger = useMutation({
    mutationFn: () => api.runPipelineAsync(profileUuid),
    onSuccess: accepted => {
      setActiveRunUuid(accepted.run_uuid)   // optimistic: UI shows running immediately
      void queryClient.invalidateQueries({ queryKey: ["runs", profileUuid] })
    },
    onError: (err: ApiError) =>
      toast.error(err.code === "rate_limited" ? "Slow down — rate limit hit. Try again in a minute." : err.message),
  })

  const runQuery = useQuery({
    queryKey: ["run", activeRunUuid],
    queryFn: () => api.getRun(activeRunUuid!),
    enabled: !!activeRunUuid,
    refetchInterval: q =>
      q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000,
  })

  // On terminal transition: refresh everything, toast once.
  const notifiedRef = useRef<string | null>(null)
  useEffect(() => {
    const run = runQuery.data
    if (!run || !TERMINAL.has(run.status)) return
    if (notifiedRef.current === run.run_uuid) return
    notifiedRef.current = run.run_uuid
    for (const key of [["profile", profileUuid], ["queries", profileUuid], ["recommendations", profileUuid], ["runs", profileUuid], ["profiles"]]) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
    if (run.status === "completed") {
      toast.success(`Pipeline finished — ${run.queries_scored} queries scored`)
    } else {
      toast.error(`Pipeline failed: ${run.error_message ?? "unknown error"}`)
    }
  }, [runQuery.data, profileUuid, queryClient])

  const activeRun: RunPayload | undefined = runQuery.data
  const isRunning =
    trigger.isPending || (!!activeRun && !TERMINAL.has(activeRun.status)) ||
    (!!activeRunUuid && !activeRun)
  return { trigger, activeRun, isRunning }
}
```

- [ ] **Step 2: PipelineStatus** — `frontend/src/components/PipelineStatus.tsx`:
```tsx
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import type { RunPayload } from "@/types"

export function PipelineStatus({ run }: { run: RunPayload }) {
  if (run.status === "running" || run.status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>
          Pipeline running… {run.queries_discovered > 0 && `${run.queries_discovered} queries discovered`}
        </span>
      </div>
    )
  }
  if (run.status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <XCircle className="size-4" />
        <span>Run failed: {run.error_message ?? "unknown error"}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <CheckCircle2 className="size-4 text-success" />
      <span>
        Last run: {run.queries_scored} scored · {run.recommendations.length} recommendations ·{" "}
        {run.tokens_used.toLocaleString()} tokens
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Page** — `frontend/src/pages/ProfileDetail.tsx`:
```tsx
import { Loader2, Play } from "lucide-react"
import { useParams } from "react-router"
import { PipelineStatus } from "@/components/PipelineStatus"
import { StatusBadge } from "@/components/StatusBadge"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useProfile } from "@/hooks/useProfile"
import { usePipeline } from "@/hooks/usePipeline"

export default function ProfileDetail() {
  const { uuid = "" } = useParams()
  const profileQuery = useProfile(uuid)
  const { trigger, activeRun, isRunning } = usePipeline(uuid)

  if (profileQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }
  if (profileQuery.isError) {
    return <ErrorState message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
  }
  const profile = profileQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{profile.name}</h1>
            <StatusBadge status={profile.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.domain} · {profile.industry}
          </p>
          {profile.competitors.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              vs {profile.competitors.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="tabular-nums">
              <span className="font-semibold">{profile.total_queries}</span>{" "}
              <span className="text-muted-foreground">queries</span>
            </p>
            <p className="tabular-nums">
              <span className="font-semibold">{profile.avg_opportunity_score?.toFixed(2) ?? "—"}</span>{" "}
              <span className="text-muted-foreground">avg score</span>
            </p>
          </div>
          <Button onClick={() => trigger.mutate()} disabled={isRunning}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {isRunning ? "Running…" : "Run Pipeline"}
          </Button>
        </div>
      </div>

      {activeRun && <PipelineStatus run={activeRun} />}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queries">Queries</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <EmptyState title="Charts land in Task 10" />
        </TabsContent>
        <TabsContent value="queries" className="mt-4">
          <EmptyState title="Queries table lands in Task 7" />
        </TabsContent>
        <TabsContent value="recommendations" className="mt-4">
          <EmptyState title="Recommendations land in Task 8" />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <EmptyState title="Run history lands in Task 9" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Verify** — `pnpm test && pnpm build` green. Manual (backend running, keys optional): Run Pipeline → button disables instantly, PipelineStatus pulses, run reaches `completed`/`failed` (keyless backend → fast fail with toast showing error_message — that IS the correct behavior), stats refresh.
- [ ] **Step 5: Commit** — `git add frontend && git commit -m "feat(frontend): profile detail with live pipeline trigger + polling"`

---

### Task 7: Queries tab — filters (Zustand), table, pagination, recheck

**Files:**
- Create: `frontend/src/stores/queryFilters.ts`, `frontend/src/hooks/useQueries.ts`, `frontend/src/hooks/useRecheck.ts`, `frontend/src/components/QueryFilters.tsx`, `frontend/src/components/QueryTable.tsx`, `frontend/src/components/PaginationControls.tsx`, `frontend/src/pages/tabs/QueriesTab.tsx`
- Modify: `frontend/src/pages/ProfileDetail.tsx` (mount tab)
- Test: `frontend/src/stores/queryFilters.test.ts`

**Interfaces:**
- Consumes: `api.listQueries`, `api.recheckQuery`.
- Produces: `useQueryFilters()` Zustand micro-store `{ minScore, status, page, perPage, setMinScore, setStatus, setPage, setPerPage, reset }` (page resets to 1 on filter change — business rule lives IN the store); `useQueriesList(profileUuid)`; `useRecheck(profileUuid)` with optimistic per-row "checking" state.

- [ ] **Step 1: Failing store test** — `frontend/src/stores/queryFilters.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest"
import { useQueryFilters } from "./queryFilters"

describe("queryFilters store", () => {
  beforeEach(() => useQueryFilters.getState().reset())

  it("defaults: no filters, page 1, 20 per page", () => {
    const s = useQueryFilters.getState()
    expect(s.minScore).toBe(0)
    expect(s.status).toBeUndefined()
    expect(s.page).toBe(1)
    expect(s.perPage).toBe(20)
  })

  it("changing a filter resets page to 1", () => {
    useQueryFilters.getState().setPage(3)
    useQueryFilters.getState().setStatus("not_visible")
    expect(useQueryFilters.getState().page).toBe(1)
    useQueryFilters.getState().setPage(2)
    useQueryFilters.getState().setMinScore(0.5)
    expect(useQueryFilters.getState().page).toBe(1)
  })

  it("changing page size resets page", () => {
    useQueryFilters.getState().setPage(4)
    useQueryFilters.getState().setPerPage(50)
    const s = useQueryFilters.getState()
    expect(s.perPage).toBe(50)
    expect(s.page).toBe(1)
  })
})
```

- [ ] **Step 2: Run** — `pnpm test` — Expected: FAIL (store missing).

- [ ] **Step 3: Store** — `frontend/src/stores/queryFilters.ts`:
```ts
import { create } from "zustand"
import type { VisibilityStatus } from "@/types"

interface QueryFiltersState {
  minScore: number
  status: VisibilityStatus | undefined
  page: number
  perPage: number
  setMinScore: (v: number) => void
  setStatus: (v: VisibilityStatus | undefined) => void
  setPage: (v: number) => void
  setPerPage: (v: number) => void
  reset: () => void
}

const DEFAULTS = { minScore: 0, status: undefined, page: 1, perPage: 20 } as const

// ponytail: module-level singleton store; per-profile filter isolation via reset()
// on profile change — separate stores per profile if that ever matters.
export const useQueryFilters = create<QueryFiltersState>(set => ({
  ...DEFAULTS,
  setMinScore: v => set({ minScore: v, page: 1 }),
  setStatus: v => set({ status: v, page: 1 }),
  setPage: v => set({ page: v }),
  setPerPage: v => set({ perPage: v, page: 1 }),
  reset: () => set({ ...DEFAULTS }),
}))
```

- [ ] **Step 4: Hooks**

`frontend/src/hooks/useQueries.ts`:
```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"
import { useQueryFilters } from "@/stores/queryFilters"

export function useQueriesList(profileUuid: string) {
  const { minScore, status, page, perPage } = useQueryFilters()
  return useQuery({
    queryKey: ["queries", profileUuid, { minScore, status, page, perPage }],
    queryFn: () =>
      api.listQueries(profileUuid, {
        min_score: minScore > 0 ? minScore : undefined,
        status,
        page,
        per_page: perPage,
      }),
    placeholderData: keepPreviousData,
  })
}
```

`frontend/src/hooks/useRecheck.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"

export function useRecheck(profileUuid: string) {
  const queryClient = useQueryClient()
  const [checkingIds, setCheckingIds] = useState<ReadonlySet<string>>(new Set())

  const mutation = useMutation({
    mutationFn: (queryUuid: string) => api.recheckQuery(queryUuid),
    onMutate: queryUuid => {
      // optimistic UI: row flips to "checking" immediately
      setCheckingIds(prev => new Set(prev).add(queryUuid))
    },
    onSuccess: updated => {
      toast.success(`Rechecked — now ${updated.status.replace("_", " ")} (score ${updated.opportunity_score.toFixed(2)})`)
      void queryClient.invalidateQueries({ queryKey: ["queries", profileUuid] })
      void queryClient.invalidateQueries({ queryKey: ["profile", profileUuid] })
    },
    onError: (err: ApiError) => toast.error(err.message),
    onSettled: (_d, _e, queryUuid) => {
      setCheckingIds(prev => {
        const next = new Set(prev)
        next.delete(queryUuid)
        return next
      })
    },
  })
  return { recheck: mutation.mutate, checkingIds }
}
```

- [ ] **Step 5: Components**

`frontend/src/components/QueryFilters.tsx`:
```tsx
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useQueryFilters } from "@/stores/queryFilters"
import type { VisibilityStatus } from "@/types"

const ALL = "all"

export function QueryFilters() {
  const { minScore, status, setMinScore, setStatus } = useQueryFilters()
  return (
    <div className="flex flex-wrap items-end gap-6 rounded-lg border border-border bg-card p-4">
      <div className="w-56 space-y-2">
        <Label className="flex justify-between text-xs">
          <span>Min opportunity score</span>
          <span className="tabular-nums text-muted-foreground">{minScore.toFixed(2)}</span>
        </Label>
        <Slider
          value={[minScore]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => setMinScore(v)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Visibility</Label>
        <Select
          value={status ?? ALL}
          onValueChange={v => setStatus(v === ALL ? undefined : (v as VisibilityStatus))}
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
            <SelectItem value="not_visible">Not visible</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

`frontend/src/components/PaginationControls.tsx`:
```tsx
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useQueryFilters } from "@/stores/queryFilters"
import type { Pagination } from "@/types"

export function PaginationControls({ pagination }: { pagination: Pagination }) {
  const { page, perPage, setPage, setPerPage } = useQueryFilters()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {pagination.total} queries · page {pagination.page} of {pagination.total_pages}
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map(n => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline" size="icon" aria-label="Previous page"
          disabled={page <= 1} onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline" size="icon" aria-label="Next page"
          disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

`frontend/src/components/QueryTable.tsx`:
```tsx
import { Loader2, RefreshCw } from "lucide-react"
import { ScoreBar } from "@/components/ScoreBar"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { DiscoveredQuery } from "@/types"

export function QueryTable({
  queries, checkingIds, onRecheck,
}: {
  queries: DiscoveredQuery[]
  checkingIds: ReadonlySet<string>
  onRecheck: (queryUuid: string) => void
}) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Difficulty</TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.map(q => {
            const checking = checkingIds.has(q.query_uuid)
            return (
              <TableRow key={q.query_uuid}>
                <TableCell className="max-w-md">
                  <p className="truncate font-medium">{q.query_text}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.keyword} · {q.intent}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {q.estimated_search_volume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {q.competitive_difficulty}
                </TableCell>
                <TableCell><ScoreBar score={q.opportunity_score} /></TableCell>
                <TableCell>
                  {checking
                    ? <StatusBadge status="running" />
                    : <StatusBadge status={q.status} />}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon" aria-label="Recheck visibility"
                    disabled={checking} onClick={() => onRecheck(q.query_uuid)}
                  >
                    {checking
                      ? <Loader2 className="size-4 animate-spin" />
                      : <RefreshCw className="size-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
```

`frontend/src/pages/tabs/QueriesTab.tsx`:
```tsx
import { useEffect } from "react"
import { PaginationControls } from "@/components/PaginationControls"
import { QueryFilters } from "@/components/QueryFilters"
import { QueryTable } from "@/components/QueryTable"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueriesList } from "@/hooks/useQueries"
import { useRecheck } from "@/hooks/useRecheck"
import { useQueryFilters } from "@/stores/queryFilters"

export function QueriesTab({ profileUuid }: { profileUuid: string }) {
  const reset = useQueryFilters(s => s.reset)
  useEffect(() => reset(), [profileUuid, reset])   // fresh filters per profile

  const listQuery = useQueriesList(profileUuid)
  const { recheck, checkingIds } = useRecheck(profileUuid)
  const hasActiveFilters =
    useQueryFilters(s => s.minScore) > 0 || !!useQueryFilters(s => s.status)

  return (
    <div className="space-y-4">
      <QueryFilters />
      {listQuery.isPending && <Skeleton className="h-64 rounded-lg" />}
      {listQuery.isError && (
        <ErrorState message={listQuery.error.message} onRetry={() => void listQuery.refetch()} />
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No queries match these filters" : "No queries yet"}
          description={
            hasActiveFilters
              ? "Loosen the score slider or status filter."
              : "Run the pipeline to discover what people ask AI assistants in this space."
          }
        />
      )}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <>
          <QueryTable
            queries={listQuery.data.items}
            checkingIds={checkingIds}
            onRecheck={recheck}
          />
          <PaginationControls pagination={listQuery.data.pagination} />
        </>
      )}
    </div>
  )
}
```

In `ProfileDetail.tsx`, replace the queries placeholder: `<TabsContent value="queries" className="mt-4"><QueriesTab profileUuid={uuid} /></TabsContent>` (+ import).

- [ ] **Step 6: Verify** — `pnpm test` (store tests pass) `&& pnpm build`. Manual: filters drive requests (network tab shows `min_score`/`status` params), page resets on filter change, recheck spins per-row then toasts.
- [ ] **Step 7: Commit** — `git add frontend && git commit -m "feat(frontend): queries tab — zustand filters, table, pagination, optimistic recheck"`

---

### Task 8: Recommendations tab

**Files:**
- Create: `frontend/src/hooks/useRecommendations.ts`, `frontend/src/components/RecommendationCard.tsx`, `frontend/src/pages/tabs/RecommendationsTab.tsx`
- Modify: `frontend/src/pages/ProfileDetail.tsx` (mount tab)

**Interfaces:**
- Consumes: `api.listRecommendations`.
- Produces: recommendations grouped High → Medium → Low.

- [ ] **Step 1: Hook** — `frontend/src/hooks/useRecommendations.ts`:
```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useRecommendations(profileUuid: string) {
  return useQuery({
    queryKey: ["recommendations", profileUuid],
    queryFn: () => api.listRecommendations(profileUuid),
  })
}
```

- [ ] **Step 2: Card** — `frontend/src/components/RecommendationCard.tsx`:
```tsx
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Recommendation } from "@/types"

const PRIORITY_STYLES: Record<Recommendation["priority"], string> = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-muted-foreground",
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card className={cn("border-l-4", PRIORITY_STYLES[rec.priority])}>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {rec.content_type.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">{rec.priority} priority</Badge>
        </div>
        <CardTitle className="text-base">{rec.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{rec.rationale}</p>
        <div className="flex flex-wrap gap-1.5">
          {rec.target_keywords.map(k => (
            <Badge key={k} variant="secondary" className="font-normal">{k}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Tab** — `frontend/src/pages/tabs/RecommendationsTab.tsx`:
```tsx
import { RecommendationCard } from "@/components/RecommendationCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecommendations } from "@/hooks/useRecommendations"
import type { Priority } from "@/types"

const ORDER: Priority[] = ["high", "medium", "low"]

export function RecommendationsTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useRecommendations(profileUuid)

  if (isPending) return <Skeleton className="h-64 rounded-lg" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Run the pipeline — recommendations target the queries where this domain is absent from AI answers."
      />
    )
  }

  return (
    <div className="space-y-6">
      {ORDER.map(priority => {
        const group = data.items.filter(r => r.priority === priority)
        if (!group.length) return null
        return (
          <section key={priority} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {priority} priority
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {group.map(rec => <RecommendationCard key={rec.recommendation_uuid} rec={rec} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
```

Mount in `ProfileDetail.tsx` (replace placeholder).

- [ ] **Step 4: Verify + commit** — `pnpm test && pnpm build` green. `git add frontend && git commit -m "feat(frontend): recommendations tab grouped by priority"`

---

### Task 9: Runs tab — history

**Files:**
- Create: `frontend/src/hooks/useRuns.ts`, `frontend/src/components/RunsTable.tsx`, `frontend/src/pages/tabs/RunsTab.tsx`
- Modify: `frontend/src/pages/ProfileDetail.tsx` (mount tab)

- [ ] **Step 1: Hook** — `frontend/src/hooks/useRuns.ts`:
```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useRuns(profileUuid: string) {
  return useQuery({
    queryKey: ["runs", profileUuid],
    queryFn: () => api.listRuns(profileUuid),
  })
}
```

- [ ] **Step 2: Table** — `frontend/src/components/RunsTable.tsx`:
```tsx
import { StatusBadge } from "@/components/StatusBadge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { PipelineRun } from "@/types"

function duration(run: PipelineRun): string {
  if (!run.completed_at) return "—"
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
  return `${Math.max(Math.round(ms / 1000), 0)}s`
}

export function RunsTable({ runs }: { runs: PipelineRun[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Discovered</TableHead>
            <TableHead className="text-right">Scored</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map(run => (
            <TableRow key={run.run_uuid}>
              <TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  {run.error_message && (
                    <span className="max-w-56 truncate text-xs text-muted-foreground" title={run.error_message}>
                      {run.error_message}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.queries_discovered}</TableCell>
              <TableCell className="text-right tabular-nums">{run.queries_scored}</TableCell>
              <TableCell className="text-right tabular-nums">{run.tokens_used.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{duration(run)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Tab** — `frontend/src/pages/tabs/RunsTab.tsx`:
```tsx
import { RunsTable } from "@/components/RunsTable"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useRuns } from "@/hooks/useRuns"

export function RunsTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useRuns(profileUuid)

  if (isPending) return <Skeleton className="h-48 rounded-lg" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return <EmptyState title="No runs yet" description="Trigger the pipeline to see run history here." />
  }
  return <RunsTable runs={data.items} />
}
```

Mount in `ProfileDetail.tsx`.

- [ ] **Step 4: Verify + commit** — `pnpm test && pnpm build`. `git add frontend && git commit -m "feat(frontend): pipeline run history tab"`

---

### Task 10: Overview tab — charts

**IMPORTANT for the implementer:** read the `dataviz` skill BEFORE writing chart code (invoke it if available in your session; if not, follow the guidance encoded below: use only `var(--chart-N)` colors, label axes, no gridline clutter, tooltips via shadcn ChartTooltip).

**Files:**
- Create: `frontend/src/components/charts/ScoreDistribution.tsx`, `frontend/src/components/charts/VolumeDifficultyScatter.tsx`, `frontend/src/pages/tabs/OverviewTab.tsx`
- Modify: `frontend/src/pages/ProfileDetail.tsx` (mount tab)

**Interfaces:**
- Consumes: `api.listQueries` with `per_page: 100` (chart data key `["queries", uuid, "all"]`).
- Produces: histogram of opportunity scores (10 buckets) + volume-vs-difficulty scatter colored by visibility status.

- [ ] **Step 1: Overview tab with data fetch** — `frontend/src/pages/tabs/OverviewTab.tsx`:
```tsx
import { useQuery } from "@tanstack/react-query"
import { ScoreDistribution } from "@/components/charts/ScoreDistribution"
import { VolumeDifficultyScatter } from "@/components/charts/VolumeDifficultyScatter"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/services/api"

export function OverviewTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["queries", profileUuid, "all"],
    queryFn: () => api.listQueries(profileUuid, { per_page: 100 }),
  })

  if (isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Nothing to chart yet"
        description="Run the pipeline to see the opportunity landscape."
      />
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ScoreDistribution queries={data.items} />
      <VolumeDifficultyScatter queries={data.items} />
    </div>
  )
}
```

- [ ] **Step 2: Histogram** — `frontend/src/components/charts/ScoreDistribution.tsx`:
```tsx
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { DiscoveredQuery } from "@/types"

const config = {
  count: { label: "Queries", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ScoreDistribution({ queries }: { queries: DiscoveredQuery[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    count: 0,
  }))
  for (const q of queries) {
    const i = Math.min(Math.floor(q.opportunity_score * 10), 9)
    buckets[i].count += 1
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Opportunity score distribution</CardTitle>
        <CardDescription>Where this profile's {queries.length} queries fall</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={buckets} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Scatter** — `frontend/src/components/charts/VolumeDifficultyScatter.tsx`:
```tsx
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { DiscoveredQuery, VisibilityStatus } from "@/types"

const config = {
  visible: { label: "Visible", color: "var(--chart-2)" },
  not_visible: { label: "Not visible", color: "var(--chart-4)" },
  unknown: { label: "Unknown", color: "var(--chart-5)" },
} satisfies ChartConfig

const GROUPS: VisibilityStatus[] = ["not_visible", "visible", "unknown"]

export function VolumeDifficultyScatter({ queries }: { queries: DiscoveredQuery[] }) {
  const byStatus = (status: VisibilityStatus) =>
    queries
      .filter(q => q.status === status)
      .map(q => ({
        difficulty: q.competitive_difficulty,
        volume: q.estimated_search_volume,
        score: q.opportunity_score,
        name: q.query_text,
      }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume vs difficulty</CardTitle>
        <CardDescription>Top-left = high demand, low competition (best gaps)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <ScatterChart margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="difficulty" name="Difficulty" domain={[0, 100]}
              tickLine={false} axisLine={false} fontSize={11}
              label={{ value: "difficulty", position: "insideBottom", offset: -4, fontSize: 11 }}
            />
            <YAxis
              type="number" dataKey="volume" name="Volume"
              tickLine={false} axisLine={false} fontSize={11} width={70}
            />
            <ZAxis type="number" dataKey="score" range={[40, 200]} name="Score" />
            <ChartTooltip content={<ChartTooltipContent />} />
            {GROUPS.map(status => (
              <Scatter
                key={status}
                name={String(config[status].label)}
                data={byStatus(status)}
                fill={`var(--color-${status})`}
                fillOpacity={0.75}
              />
            ))}
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

Mount `OverviewTab` in `ProfileDetail.tsx` (replace placeholder).

- [ ] **Step 4: Verify + commit** — `pnpm test && pnpm build`. Manual: seed data (or run pipeline) → both charts render, colors follow theme in light AND dark. `git add frontend && git commit -m "feat(frontend): overview charts — score distribution + volume/difficulty scatter"`

---

### Task 11: Docker + compose + frontend README + root sync

**Files:**
- Create: `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, `frontend/README.md`
- Modify: `d:\Assment\docker-compose.yml` (add frontend service), root `README.md` (frontend section + compose quickstart)

- [ ] **Step 1: nginx SPA config** — `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Dockerfile** — `frontend/Dockerfile`:
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Vite bakes env at BUILD time — must be an ARG, not runtime env
ARG VITE_API_BASE_URL=http://localhost:5000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`frontend/.dockerignore`:
```
node_modules/
dist/
.env
```

- [ ] **Step 3: compose** — in `d:\Assment\docker-compose.yml` add under `services:`:
```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_BASE_URL: http://localhost:5000
    ports:
      - "3000:80"
    depends_on:
      - backend
```

- [ ] **Step 4: frontend README** — `frontend/README.md` with sections: What this is (Task 2 dashboard) · Stack + why (React/Vite/TS, Tailwind+shadcn, TanStack Query for server state, Zustand micro-stores for UI state — never server data, recharts) · Setup (`pnpm i`, `cp .env.example .env`, `pnpm dev`; note `VITE_API_BASE_URL` replaces the brief's CRA-era `REACT_APP_` prefix and why) · Architecture (services/api.ts single fetch site, hooks per resource, 4-state convention, token-only theming — theme changes touch index.css only) · Screens list · Testing (`pnpm test` — what's covered) · Docker (build ARG caveat).

- [ ] **Step 5: Root README sync** — update repo-layout `frontend/` line (no longer "pending"), add frontend quickstart lines (`cd frontend && pnpm install && pnpm dev`) and a "Full stack via Docker" block: `cp backend/.env.example backend/.env` then `docker compose up --build` → API :5000, dashboard :3000.

- [ ] **Step 6: Verify** — `docker compose up --build -d` from repo root → `curl -s http://localhost:3000` returns the SPA HTML; dashboard loads in browser against :5000 API; `docker compose down`. Local `pnpm test && pnpm build` still green.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(frontend): Docker multi-stage build, compose service, READMEs — Task 2 complete"`

---

### Task 12: Responsive + polish pass

**Files:**
- Modify: any component needing it (keep diffs minimal)

- [ ] **Step 1:** Verify at 1280px and 768px (brief must-have): sidebar collapses (shadcn sidebar handles it — verify the sheet opens on tablet), profile header wraps (`flex-wrap` present), table scrolls horizontally on narrow (`overflow-x-auto` wrapper on tables if needed), charts stack (`lg:grid-cols-2` → single column below `lg` ✓), cards grid degrades (`sm:grid-cols-2 xl:grid-cols-3` ✓).
- [ ] **Step 2:** Dark-mode sweep: every screen in dark theme — no unreadable text (all colors are tokens, so failures indicate a raw class that slipped through; fix by replacing with a token class).
- [ ] **Step 3:** `pnpm build && pnpm test` green; commit any fixes: `git add frontend && git commit -m "fix(frontend): responsive + dark-mode polish pass"` (skip commit if zero changes — note it).

---

## Plan self-review (done at write time)

- **Spec coverage vs brief Task 2:** Dashboard/profile cards ✓ (T4) · Create form + validation + redirect ✓ (T5) · Profile detail + Run button + tabs ✓ (T6) · Queries table w/ filters+sort-by-score+score bar+recheck ✓ (T7; column sorting = server sorts by score desc — noted in README) · Recommendations grouped by priority ✓ (T8) · Run history ✓ (T9) · ≥1 chart ✓ (T10, two) · loading states ✓ · error states ✓ · real-time pipeline feedback via polling ✓ (T6) · min-score slider + status dropdown ✓ (T7) · sidebar nav ✓ (T1) · responsive 1280/768 ✓ (T12) · dark mode bonus ✓ (T1) · pagination w/ page-size bonus ✓ (T7) · component tests bonus ✓ (T2/T3/T7) · service layer, no raw fetch in components ✓ (T2).
- **Type consistency:** `ApiError` shape (T2) used in T5/T6/T7 hooks ✓; `Paginated<DiscoveredQuery>` consumed by T7 ✓; store API (T7 test ↔ implementation) ✓; `RunPayload.status` vs `TERMINAL` set ✓.
- **Placeholder scan:** tab placeholders in T6 are explicitly replaced by T7-T10 (named per task) — intentional sequencing, not TBDs. Charts config keys match `VisibilityStatus` values ✓.
- **Known deviations to document in README:** `VITE_API_BASE_URL` (not `REACT_APP_`); column sorting is score-desc from the server (client resort deliberately skipped — YAGNI); sparkline + Storybook bonuses skipped per spec §6.
