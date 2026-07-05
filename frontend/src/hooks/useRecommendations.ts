import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"
import type { Priority } from "@/types"

export const RECS_PER_PAGE = 8

export function useRecommendations(
  profileUuid: string, priority?: Priority, page = 1,
) {
  return useQuery({
    queryKey: ["recommendations", profileUuid, { priority, page }],
    queryFn: () =>
      api.listRecommendations(profileUuid, { priority, page, per_page: RECS_PER_PAGE }),
    placeholderData: keepPreviousData,
  })
}
