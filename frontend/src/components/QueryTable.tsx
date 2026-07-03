import { Loader2, RefreshCw } from "lucide-react"
import { ScoreBar } from "@/components/ScoreBar"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { DiscoveredQuery } from "@/types"

export function QueryTable({
  queries, checkingIds, onRecheck,
}: {
  queries: DiscoveredQuery[]
  checkingIds: ReadonlySet<string>
  onRecheck: (queryUuid: string) => void
}) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Difficulty</TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.map(q => {
            const checking = checkingIds.has(q.query_uuid)
            return (
              <TableRow key={q.query_uuid}>
                <TableCell className="max-w-md">
                  <p className="truncate font-medium">{q.query_text}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.keyword} · {q.intent}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {q.estimated_search_volume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {q.competitive_difficulty}
                </TableCell>
                <TableCell><ScoreBar score={q.opportunity_score} /></TableCell>
                <TableCell>
                  {checking
                    ? <StatusBadge status="running" />
                    : <StatusBadge status={q.status} />}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon" aria-label="Recheck visibility"
                    disabled={checking} onClick={() => onRecheck(q.query_uuid)}
                  >
                    {checking
                      ? <Loader2 className="size-4 animate-spin" />
                      : <RefreshCw className="size-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
