import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import type { RunPayload } from "@/types"

export function PipelineStatus({ run }: { run: RunPayload }) {
  if (run.status === "running" || run.status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>
          Pipeline running… {run.queries_discovered > 0 && `${run.queries_discovered} queries discovered`}
        </span>
      </div>
    )
  }
  if (run.status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <XCircle className="size-4" />
        <span>Run failed: {run.error_message ?? "unknown error"}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <CheckCircle2 className="size-4 text-success" />
      <span>
        Last run: {run.queries_scored} scored · {run.recommendations.length} recommendations ·{" "}
        {run.tokens_used.toLocaleString()} tokens
      </span>
    </div>
  )
}
