import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"

export function useRecheck(profileUuid: string) {
  const queryClient = useQueryClient()
  const [checkingIds, setCheckingIds] = useState<ReadonlySet<string>>(new Set())

  const mutation = useMutation({
    mutationFn: (queryUuid: string) => api.recheckQuery(queryUuid),
    onMutate: queryUuid => {
      // optimistic UI: row flips to "checking" immediately
      setCheckingIds(prev => new Set(prev).add(queryUuid))
    },
    onSuccess: updated => {
      toast.success(`Rechecked — now ${updated.status.replace("_", " ")} (score ${updated.opportunity_score.toFixed(2)})`)
      void queryClient.invalidateQueries({ queryKey: ["queries", profileUuid] })
      void queryClient.invalidateQueries({ queryKey: ["profile", profileUuid] })
    },
    onError: (err: ApiError) => toast.error(err.message),
    onSettled: (_d, _e, queryUuid) => {
      setCheckingIds(prev => {
        const next = new Set(prev)
        next.delete(queryUuid)
        return next
      })
    },
  })
  return { recheck: mutation.mutate, checkingIds }
}
