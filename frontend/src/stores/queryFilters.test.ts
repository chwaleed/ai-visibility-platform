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
