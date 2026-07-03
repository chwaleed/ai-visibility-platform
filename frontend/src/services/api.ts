import axios from "axios"
import type { AxiosResponse } from "axios"
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

export const http = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
})

// Success bodies are bare (spec-shaped); errors carry {"error": {code, message}}.
async function request<T>(call: Promise<AxiosResponse<T>>): Promise<T> {
  try {
    return (await call).data
  } catch (e: unknown) {
    const res = (e as { response?: { status: number; data?: unknown } }).response
    if (!res) {
      throw new ApiError("network_error", "Could not reach the API — is the backend running?", 0)
    }
    const err = (res.data as { error?: { code?: string; message?: string; details?: unknown } })?.error
    throw new ApiError(
      err?.code ?? "unknown_error",
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details,
    )
  }
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
  listProfiles: () => request(http.get<{ items: ProfileWithStats[] }>("/profiles")),
  getProfile: (uuid: string) => request(http.get<Profile & ProfileStats>(`/profiles/${uuid}`)),
  createProfile: (body: ProfileCreateBody) =>
    request(http.post<ProfileCreated>("/profiles", body)),
  runPipelineAsync: (uuid: string) =>
    request(http.post<RunAccepted>(`/profiles/${uuid}/run?async=1`)),
  getRun: (runUuid: string) => request(http.get<RunPayload>(`/runs/${runUuid}`)),
  listRuns: (uuid: string) => request(http.get<{ items: PipelineRun[] }>(`/profiles/${uuid}/runs`)),
  listQueries: (uuid: string, params: QueryListParams = {}) =>
    request(http.get<Paginated<DiscoveredQuery>>(`/profiles/${uuid}/queries${buildQueryString(params)}`)),
  recheckQuery: (queryUuid: string) =>
    request(http.post<DiscoveredQuery>(`/queries/${queryUuid}/recheck`)),
  listRecommendations: (uuid: string) =>
    request(http.get<{ items: Recommendation[] }>(`/profiles/${uuid}/recommendations`)),
}
