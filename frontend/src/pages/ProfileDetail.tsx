import { Loader2, Play } from "lucide-react"
import { useParams } from "react-router"
import { PipelineStatus } from "@/components/PipelineStatus"
import { StatusBadge } from "@/components/StatusBadge"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueriesTab } from "@/pages/tabs/QueriesTab"
import { RecommendationsTab } from "@/pages/tabs/RecommendationsTab"
import { useProfile } from "@/hooks/useProfile"
import { usePipeline } from "@/hooks/usePipeline"

export default function ProfileDetail() {
  const { uuid = "" } = useParams()
  const profileQuery = useProfile(uuid)
  const { trigger, activeRun, isRunning } = usePipeline(uuid)

  if (profileQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }
  if (profileQuery.isError) {
    return <ErrorState message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
  }
  const profile = profileQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{profile.name}</h1>
            <StatusBadge status={profile.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.domain} · {profile.industry}
          </p>
          {profile.competitors.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              vs {profile.competitors.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="tabular-nums">
              <span className="font-semibold">{profile.total_queries}</span>{" "}
              <span className="text-muted-foreground">queries</span>
            </p>
            <p className="tabular-nums">
              <span className="font-semibold">{profile.avg_opportunity_score?.toFixed(2) ?? "—"}</span>{" "}
              <span className="text-muted-foreground">avg score</span>
            </p>
          </div>
          <Button onClick={() => trigger.mutate()} disabled={isRunning}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {isRunning ? "Running…" : "Run Pipeline"}
          </Button>
        </div>
      </div>

      {activeRun && <PipelineStatus run={activeRun} />}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queries">Queries</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <EmptyState title="Charts land in Task 10" />
        </TabsContent>
        <TabsContent value="queries" className="mt-4">
          <QueriesTab profileUuid={uuid} />
        </TabsContent>
        <TabsContent value="recommendations" className="mt-4">
          <RecommendationsTab profileUuid={uuid} />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <EmptyState title="Run history lands in Task 9" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
