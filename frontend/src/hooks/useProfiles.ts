import { useQuery } from "@tanstack/react-query"
import { api } from "@/services/api"

export function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles })
}
