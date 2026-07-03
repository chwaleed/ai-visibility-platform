import { RecommendationCard } from "@/components/RecommendationCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecommendations } from "@/hooks/useRecommendations"
import type { Priority } from "@/types"

const ORDER: Priority[] = ["high", "medium", "low"]

export function RecommendationsTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useRecommendations(profileUuid)

  if (isPending) return <Skeleton className="h-64 rounded-lg" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Run the pipeline — recommendations target the queries where this domain is absent from AI answers."
      />
    )
  }

  return (
    <div className="space-y-6">
      {ORDER.map(priority => {
        const group = data.items.filter(r => r.priority === priority)
        if (!group.length) return null
        return (
          <section key={priority} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {priority} priority
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {group.map(rec => <RecommendationCard key={rec.recommendation_uuid} rec={rec} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
