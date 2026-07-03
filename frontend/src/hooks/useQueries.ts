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
