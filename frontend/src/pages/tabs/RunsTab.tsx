import { useState } from "react"
import { Pager } from "@/components/Pager"
import { RunsTable } from "@/components/RunsTable"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { RUNS_PER_PAGE, useRuns } from "@/hooks/useRuns"

export function RunsTab({ profileUuid }: { profileUuid: string }) {
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error, refetch } = useRuns(profileUuid, page)

  if (isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />
  if (data.pagination.total === 0) {
    return <EmptyState title="No runs yet" description="Trigger the pipeline to see run history here." />
  }

  const { pagination } = data
  const start = (pagination.page - 1) * RUNS_PER_PAGE

  return (
    <div className="space-y-3.5">
      <RunsTable runs={data.items} />
      {pagination.total_pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-xs text-muted-foreground">
            Showing {start + 1}–{Math.min(start + RUNS_PER_PAGE, pagination.total)} of {pagination.total}
          </span>
          <Pager page={pagination.page} totalPages={pagination.total_pages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
