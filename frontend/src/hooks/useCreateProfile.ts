import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"
import type { ProfileCreateBody } from "@/types"

export function useCreateProfile() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (body: ProfileCreateBody) => api.createProfile(body),
    onSuccess: created => {
      void queryClient.invalidateQueries({ queryKey: ["profiles"] })
      toast.success(`Profile "${created.name}" created`)
      void navigate(`/profiles/${created.profile_uuid}`)
    },
    onError: (err: ApiError) => toast.error(err.message),
  })
}
