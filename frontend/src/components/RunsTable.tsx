import { StatusBadge } from "@/components/StatusBadge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { PipelineRun } from "@/types"

function duration(run: PipelineRun): string {
  if (!run.completed_at) return "—"
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
  return `${Math.max(Math.round(ms / 1000), 0)}s`
}

export function RunsTable({ runs }: { runs: PipelineRun[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Discovered</TableHead>
            <TableHead className="text-right">Scored</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map(run => (
            <TableRow key={run.run_uuid}>
              <TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  {run.error_message && (
                    <span className="max-w-56 truncate text-xs text-muted-foreground" title={run.error_message}>
                      {run.error_message}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.queries_discovered}</TableCell>
              <TableCell className="text-right tabular-nums">{run.queries_scored}</TableCell>
              <TableCell className="text-right tabular-nums">{run.tokens_used.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{duration(run)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
