import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useRuns(profileUuid: string) {
  return useQuery({
    queryKey: ["runs", profileUuid],
    queryFn: () => api.listRuns(profileUuid),
  })
}
