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
