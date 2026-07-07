import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { ScoreDistribution } from "@/components/charts/ScoreDistribution"
import { VolumeDifficultyScatter } from "@/components/charts/VolumeDifficultyScatter"
import { IconBadge } from "@/components/SectionHeading"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/services/api"
import type { DiscoveredQuery } from "@/types"

function VisibilityBreakdown({ queries }: { queries: DiscoveredQuery[] }) {
  const total = queries.length
  const vis = queries.filter(q => q.status === "visible").length
  const not = queries.filter(q => q.status === "not_visible").length
  const unk = total - vis - not
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%")

  const rows: [string, number, string][] = [
    ["Visible", vis, "bg-chart-2"],
    ["Not visible", not, "bg-chart-4"],
    ["Unknown", unk, "bg-chart-5"],
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 flex items-center gap-2.5 text-[14.5px] font-semibold">
        <IconBadge icon={Eye} />
        Visibility breakdown
      </h3>
      <div className="mb-3.5 flex h-3.5 overflow-hidden rounded-lg bg-muted">
        <div className="bg-chart-2" style={{ width: pct(vis) }} />
        <div className="bg-chart-4" style={{ width: pct(not) }} />
        <div className="bg-chart-5" style={{ width: pct(unk) }} />
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-2">
        {rows.map(([label, n, dot]) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-[3px] ${dot}`} />
            <span className="text-[12.5px] text-secondary-foreground">{label}</span>
            <span className="text-[12.5px] font-semibold tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["queries", profileUuid, "all"],
    queryFn: () => api.listQueries(profileUuid, { per_page: 100 }),
  })

  if (isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Nothing to chart yet"
        description="Run the pipeline to see the opportunity landscape."
      />
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreDistribution queries={data.items} />
        <VolumeDifficultyScatter queries={data.items} />
      </div>
      <VisibilityBreakdown queries={data.items} />
    </div>
  )
}
