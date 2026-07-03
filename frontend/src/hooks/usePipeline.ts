import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/services/api"
import type { ApiError } from "@/services/api"
import type { RunPayload } from "@/types"

const TERMINAL = new Set(["completed", "failed"])

export function usePipeline(profileUuid: string) {
  const queryClient = useQueryClient()
  const [activeRunUuid, setActiveRunUuid] = useState<string | null>(null)

  // Resume polling after a page refresh if the latest run is still running.
  const runsQuery = useQuery({
    queryKey: ["runs", profileUuid],
    queryFn: () => api.listRuns(profileUuid),
  })
  useEffect(() => {
    const latest = runsQuery.data?.items[0]
    if (!activeRunUuid && latest && latest.status === "running") {
      setActiveRunUuid(latest.run_uuid)
    }
  }, [runsQuery.data, activeRunUuid])

  const trigger = useMutation({
    mutationFn: () => api.runPipelineAsync(profileUuid),
    onSuccess: accepted => {
      setActiveRunUuid(accepted.run_uuid)   // optimistic: UI shows running immediately
      void queryClient.invalidateQueries({ queryKey: ["runs", profileUuid] })
    },
    onError: (err: ApiError) =>
      toast.error(err.code === "rate_limited" ? "Slow down — rate limit hit. Try again in a minute." : err.message),
  })

  const runQuery = useQuery({
    queryKey: ["run", activeRunUuid],
    queryFn: () => api.getRun(activeRunUuid!),
    enabled: !!activeRunUuid,
    refetchInterval: q =>
      q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000,
  })

  // On terminal transition: refresh everything, toast once.
  const notifiedRef = useRef<string | null>(null)
  useEffect(() => {
    const run = runQuery.data
    if (!run || !TERMINAL.has(run.status)) return
    if (notifiedRef.current === run.run_uuid) return
    notifiedRef.current = run.run_uuid
    for (const key of [["profile", profileUuid], ["queries", profileUuid], ["recommendations", profileUuid], ["runs", profileUuid], ["profiles"]]) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
    if (run.status === "completed") {
      toast.success(`Pipeline finished — ${run.queries_scored} queries scored`)
    } else {
      toast.error(`Pipeline failed: ${run.error_message ?? "unknown error"}`)
    }
  }, [runQuery.data, profileUuid, queryClient])

  const activeRun: RunPayload | undefined = runQuery.data
  const isRunning =
    trigger.isPending || (!!activeRun && !TERMINAL.has(activeRun.status)) ||
    (!!activeRunUuid && !activeRun)
  return { trigger, activeRun, isRunning }
}
