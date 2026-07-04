import { Loader2, RefreshCw } from "lucide-react"
import { ScoreBar } from "@/components/ScoreBar"
import { StatusBadge } from "@/components/StatusBadge"
import type { DiscoveredQuery } from "@/types"

const TH = "px-3 py-2.5 font-medium"

export function QueryTable({
  queries, checkingIds, onRecheck,
}: {
  queries: DiscoveredQuery[]
  checkingIds: ReadonlySet<string>
  onRecheck: (queryUuid: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-muted-foreground/90">
            <th className={TH}>Query</th>
            <th className={`${TH} text-right`}>Volume</th>
            <th className={`${TH} text-right`}>Difficulty</th>
            <th className={TH}>Opportunity</th>
            <th className={TH}>Visibility</th>
            <th className={TH}>Pos.</th>
            <th className={`${TH} w-9`} />
          </tr>
        </thead>
        <tbody>
          {queries.map(q => {
            const checking = checkingIds.has(q.query_uuid)
            return (
              <tr key={q.query_uuid} className="border-t border-muted">
                <td className="max-w-[250px] p-3">
                  <div className="truncate font-medium text-foreground">{q.query_text}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {q.keyword} · {q.intent}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums text-secondary-foreground">
                  {q.estimated_search_volume.toLocaleString()}
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  {q.competitive_difficulty}
                </td>
                <td className="p-3"><ScoreBar score={q.opportunity_score} /></td>
                <td className="p-3">
                  <StatusBadge status={checking ? "running" : q.status} />
                </td>
                <td className="p-3 tabular-nums text-secondary-foreground">
                  {q.visibility_position != null ? `#${q.visibility_position}` : "—"}
                </td>
                <td className="p-3 text-center">
                  <button
                    aria-label="Recheck visibility"
                    title="Recheck visibility"
                    disabled={checking}
                    onClick={() => onRecheck(q.query_uuid)}
                    className="text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                  >
                    {checking
                      ? <Loader2 className="size-4 animate-spin" />
                      : <RefreshCw className="size-4" />}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
