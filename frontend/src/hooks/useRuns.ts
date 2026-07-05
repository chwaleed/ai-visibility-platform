import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export const RUNS_PER_PAGE = 10

export function useRuns(profileUuid: string, page = 1) {
  return useQuery({
    queryKey: ["runs", profileUuid, page],
    queryFn: () => api.listRuns(profileUuid, { page, per_page: RUNS_PER_PAGE }),
    placeholderData: keepPreviousData,
  })
}
