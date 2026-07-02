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
