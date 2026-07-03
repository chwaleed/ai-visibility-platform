import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, api, http } from "./api"

afterEach(() => vi.restoreAllMocks())

describe("api client", () => {
  it("returns parsed JSON on success", async () => {
    vi.spyOn(http, "get").mockResolvedValueOnce({ data: { items: [] } })
    const res = await api.listProfiles()
    expect(res.items).toEqual([])
  })

  it("throws ApiError with backend code/message on error envelope", async () => {
    vi.spyOn(http, "get").mockRejectedValueOnce({
      response: { status: 404, data: { error: { code: "not_found", message: "Profile x not found" } } },
    })
    const err = await api.getProfile("x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe("not_found")
    expect((err as ApiError).message).toBe("Profile x not found")
    expect((err as ApiError).status).toBe(404)
  })

  it("builds query strings from params, omitting undefined", async () => {
    const get = vi.spyOn(http, "get").mockResolvedValueOnce({
      data: { items: [], pagination: { page: 2, per_page: 10, total: 0, total_pages: 1 } },
    })
    await api.listQueries("p1", { min_score: 0.5, page: 2, per_page: 10 })
    const url = get.mock.calls[0][0]
    expect(url).toContain("/profiles/p1/queries?")
    expect(url).toContain("min_score=0.5")
    expect(url).toContain("page=2")
    expect(url).not.toContain("status=")
  })

  it("wraps network failures (no response) in ApiError", async () => {
    vi.spyOn(http, "get").mockRejectedValueOnce(new Error("Network Error"))
    const err = await api.listProfiles().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe("network_error")
  })
})
