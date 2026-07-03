import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useProfile(uuid: string) {
  return useQuery({ queryKey: ["profile", uuid], queryFn: () => api.getProfile(uuid) })
}
