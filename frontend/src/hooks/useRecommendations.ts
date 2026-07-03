import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useRecommendations(profileUuid: string) {
  return useQuery({
    queryKey: ["recommendations", profileUuid],
    queryFn: () => api.listRecommendations(profileUuid),
  })
}
