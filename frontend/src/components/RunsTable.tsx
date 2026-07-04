import { StatusBadge } from "@/components/StatusBadge"
import type { PipelineRun } from "@/types"

function duration(run: PipelineRun): string {
  if (!run.completed_at) return "—"
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
  return `${Math.max(Math.round(ms / 1000), 0)}s`
}

const TH = "px-3 py-2.5 font-medium"

export function RunsTable({ runs }: { runs: PipelineRun[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
      <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-muted-foreground/90">
            <th className={TH}>Started</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Discovered</th>
            <th className={`${TH} text-right`}>Scored</th>
            <th className={`${TH} text-right`}>Tokens</th>
            <th className={`${TH} text-right`}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.run_uuid} className="border-t border-muted">
              <td className="px-3 py-3.5 text-secondary-foreground">
                {new Date(run.started_at).toLocaleString()}
              </td>
              <td className="px-3 py-3.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  {run.error_message && (
                    <span className="max-w-56 truncate text-[11px] text-muted-foreground" title={run.error_message}>
                      {run.error_message}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3.5 text-right tabular-nums text-secondary-foreground">{run.queries_discovered}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-secondary-foreground">{run.queries_scored}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{run.tokens_used.toLocaleString()}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{duration(run)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
