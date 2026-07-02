import type {
  DiscoveredQuery, Paginated, PipelineRun, Profile, ProfileCreateBody,
  ProfileCreated, ProfileStats, ProfileWithStats, QueryListParams,
  Recommendation, RunAccepted, RunPayload,
} from "@/types"

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"}/api/v1`

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
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

function buildQueryString(params: QueryListParams): string {
  return qs(params as Record<string, string | number | undefined>)
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
    request<Paginated<DiscoveredQuery>>(`/profiles/${uuid}/queries${buildQueryString(params)}`),
  recheckQuery: (queryUuid: string) =>
    request<DiscoveredQuery>(`/queries/${queryUuid}/recheck`, { method: "POST" }),
  listRecommendations: (uuid: string) =>
    request<{ items: Recommendation[] }>(`/profiles/${uuid}/recommendations`),
}
