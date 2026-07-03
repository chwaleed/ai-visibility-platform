import { useQuery } from "@tanstack/react-query"
import { ScoreDistribution } from "@/components/charts/ScoreDistribution"
import { VolumeDifficultyScatter } from "@/components/charts/VolumeDifficultyScatter"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/services/api"

export function OverviewTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["queries", profileUuid, "all"],
    queryFn: () => api.listQueries(profileUuid, { per_page: 100 }),
  })

  if (isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
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
    <div className="grid gap-4 lg:grid-cols-2">
      <ScoreDistribution queries={data.items} />
      <VolumeDifficultyScatter queries={data.items} />
    </div>
  )
}
