import { useQuery } from "@tanstack/react-query"
import { Loader2, Play } from "lucide-react"
import { useState } from "react"
import { useParams } from "react-router"
import { NoRunBanner, PipelineStatus } from "@/components/PipelineStatus"
import { StatCard } from "@/components/StatCard"
import { StatusBadge } from "@/components/StatusBadge"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { OverviewTab } from "@/pages/tabs/OverviewTab"
import { QueriesTab } from "@/pages/tabs/QueriesTab"
import { RecommendationsTab } from "@/pages/tabs/RecommendationsTab"
import { RunsTab } from "@/pages/tabs/RunsTab"
import { cn } from "@/lib/utils"
import { api } from "@/services/api"
import { useProfile } from "@/hooks/useProfile"
import { usePipeline } from "@/hooks/usePipeline"
import { useRecommendations } from "@/hooks/useRecommendations"
import { useRuns } from "@/hooks/useRuns"
import type { PipelineRun } from "@/types"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "queries", label: "Queries" },
  { id: "recommendations", label: "Recommendations" },
  { id: "runs", label: "Runs" },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function ProfileDetail() {
  const { uuid = "" } = useParams()
  const [tab, setTab] = useState<TabId>("overview")
  const profileQuery = useProfile(uuid)
  const { trigger, activeRun, isRunning } = usePipeline(uuid)
  const runsQuery = useRuns(uuid)
  const recsQuery = useRecommendations(uuid)
  const allQueries = useQuery({
    queryKey: ["queries", uuid, "all"],
    queryFn: () => api.listQueries(uuid, { per_page: 100 }),
  })

  if (profileQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[78px] rounded-[14px]" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }
  if (profileQuery.isError) {
    return <ErrorState message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
  }
  const profile = profileQuery.data

  const items = allQueries.data?.items ?? []
  const visN = items.filter(q => q.status === "visible").length
  const visRate = items.length ? `${Math.round((visN / items.length) * 100)}%` : "—"
  const recsCount = recsQuery.data?.items.length ?? 0
  const lastRun = activeRun ?? runsQuery.data?.items[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-[23px] font-semibold tracking-[-0.02em]">{profile.name}</h1>
            <StatusBadge status={isRunning ? "running" : profile.status} />
          </div>
          <p className="text-[13.5px] text-muted-foreground">
            {profile.domain} · {profile.industry}
          </p>
          {profile.competitors.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground/80">vs {profile.competitors.join(", ")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right text-[13px]">
            <p className="text-secondary-foreground">
              <span className="text-[15px] font-semibold tabular-nums">{profile.total_queries}</span>{" "}
              <span className="text-muted-foreground">queries</span>
            </p>
            <p className="text-secondary-foreground">
              <span className="text-[15px] font-semibold tabular-nums">
                {profile.avg_opportunity_score?.toFixed(2) ?? "—"}
              </span>{" "}
              <span className="text-muted-foreground">avg score</span>
            </p>
          </div>
          <Button onClick={() => trigger.mutate()} disabled={isRunning}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {isRunning ? "Running…" : "Run Pipeline"}
          </Button>
        </div>
      </div>

      {/* Banner */}
      {isRunning ? (
        <PipelineStatus
          run={activeRun ?? ({ status: "running", queries_discovered: 0, queries_scored: 0 } as PipelineRun)}
          profileName={profile.name}
        />
      ) : lastRun ? (
        <PipelineStatus run={lastRun} recsCount={recsCount} onRetry={() => trigger.mutate()} />
      ) : (
        <NoRunBanner />
      )}

      {/* KPI row */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Queries" value={profile.total_queries} />
        <StatCard label="Avg Opportunity" value={profile.avg_opportunity_score?.toFixed(2) ?? "—"} />
        <StatCard
          label="Visibility Rate"
          value={visRate}
          sub={items.length ? `${visN} / ${items.length}` : undefined}
        />
        <StatCard label="Recommendations" value={recsCount} />
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-[15px] py-2.5 text-[13px] whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "overview" && <OverviewTab profileUuid={uuid} />}
        {tab === "queries" && <QueriesTab profileUuid={uuid} />}
        {tab === "recommendations" && <RecommendationsTab profileUuid={uuid} />}
        {tab === "runs" && <RunsTab profileUuid={uuid} />}
      </div>
    </div>
  )
}
