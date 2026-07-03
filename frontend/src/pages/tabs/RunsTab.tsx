import { RunsTable } from "@/components/RunsTable"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useRuns } from "@/hooks/useRuns"

export function RunsTab({ profileUuid }: { profileUuid: string }) {
  const { data, isPending, isError, error, refetch } = useRuns(profileUuid)

  if (isPending) return <Skeleton className="h-48 rounded-lg" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.items.length === 0) {
    return <EmptyState title="No runs yet" description="Trigger the pipeline to see run history here." />
  }
  return <RunsTable runs={data.items} />
}
