import { Check, Info, Loader2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineRun } from "@/types"

const STEPS = [
  "Discover queries",
  "Score opportunities",
  "Check AI visibility",
  "Generate recommendations",
]

function stageOf(run: PipelineRun): number {
  const { queries_discovered: d, queries_scored: s } = run
  if (d === 0) return 0
  if (s === 0) return 1
  if (s < d) return 2
  return 3
}

function durationOf(run: PipelineRun): string {
  if (!run.completed_at) return "—"
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
  return `${Math.max(Math.round(ms / 1000), 0)}s`
}

export function PipelineStatus({
  run, profileName, recsCount = 0, onRetry,
}: { run: PipelineRun; profileName?: string; recsCount?: number; onRetry?: () => void }) {
  if (run.status === "running" || run.status === "pending") {
    const stage = stageOf(run)
    const pct = run.queries_discovered
      ? Math.round((run.queries_scored / run.queries_discovered) * 100)
      : 0
    return (
      <div className="rounded-xl border border-accent-border bg-accent/40 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="truncate text-[12.5px] font-semibold text-secondary-foreground">
            <span className="hidden sm:inline">Running pipeline · three agents analysing {profileName ?? "this profile"}</span>
            <span className="sm:hidden">Running pipeline…</span>
          </span>
          <span className="shrink-0 text-[11.5px] font-semibold text-primary tabular-nums">{pct}%</span>
        </div>
        <div className="no-scrollbar flex items-center overflow-x-auto pb-0.5">
          {STEPS.map((title, i) => {
            const done = i < stage
            const active = i === stage
            return (
              <div key={title} className="flex flex-1 items-center gap-2 last:flex-none">
                <div className="flex shrink-0 items-center gap-2">
                  {done ? (
                    <span className="flex size-4 items-center justify-center rounded-full border border-success/30 bg-success-soft text-success sm:size-5">
                      <Check className="size-2.5 sm:size-3" />
                    </span>
                  ) : active ? (
                    <span className="flex size-4 items-center justify-center rounded-full border-2 border-primary bg-card sm:size-5">
                      <Loader2 className="size-2 animate-spin text-primary sm:size-2.5" />
                    </span>
                  ) : (
                    <span className="flex size-4 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-muted-foreground sm:size-5 sm:text-[10px]">
                      {i + 1}
                    </span>
                  )}
                  {/* labels drop on mobile — compact dots-and-connectors instead */}
                  <span
                    className={cn(
                      "hidden text-xs whitespace-nowrap sm:inline",
                      done ? "font-medium text-foreground"
                        : active ? "font-semibold text-primary"
                          : "font-medium text-muted-foreground/70",
                    )}
                  >
                    {title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded-full sm:mx-2.5",
                      done ? "bg-success/30" : "bg-accent-border",
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (run.status === "failed") {
    return (
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-[15px] py-2.5 text-[13px]">
        <span className="flex items-center gap-2.5 text-danger">
          <TriangleAlert className="size-4 shrink-0" />
          Run failed — {run.error_message ?? "unknown error"}. No changes were saved.
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-danger/40 bg-card px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  // completed
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-[15px] py-2.5 text-[13px]">
      <span className="flex size-[18px] items-center justify-center rounded-full bg-success-soft text-success">
        <Check className="size-3" />
      </span>
      <span className="text-secondary-foreground">
        Last run {new Date(run.started_at).toLocaleDateString()} — {run.queries_scored} scored ·{" "}
        {recsCount} recommendations · {run.tokens_used.toLocaleString()} tokens ·{" "}
        {durationOf(run)}
      </span>
    </div>
  )
}

export function NoRunBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-card px-[15px] py-2.5 text-[13px]">
      <span className="flex size-[18px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Info className="size-3" />
      </span>
      <span className="text-muted-foreground">
        No pipeline runs yet — run it to discover queries and recommendations.
      </span>
    </div>
  )
}
