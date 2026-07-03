import { useEffect } from "react"
import { PaginationControls } from "@/components/PaginationControls"
import { QueryFilters } from "@/components/QueryFilters"
import { QueryTable } from "@/components/QueryTable"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueriesList } from "@/hooks/useQueries"
import { useRecheck } from "@/hooks/useRecheck"
import { useQueryFilters } from "@/stores/queryFilters"

export function QueriesTab({ profileUuid }: { profileUuid: string }) {
  const reset = useQueryFilters(s => s.reset)
  useEffect(() => reset(), [profileUuid, reset])   // fresh filters per profile

  const listQuery = useQueriesList(profileUuid)
  const { recheck, checkingIds } = useRecheck(profileUuid)
  // Call both selectors unconditionally — a `||` between two hook calls would
  // short-circuit the second one and change the hook count (React error #300).
  const minScore = useQueryFilters(s => s.minScore)
  const status = useQueryFilters(s => s.status)
  const hasActiveFilters = minScore > 0 || !!status

  return (
    <div className="space-y-4">
      <QueryFilters />
      {listQuery.isPending && <Skeleton className="h-64 rounded-lg" />}
      {listQuery.isError && (
        <ErrorState message={listQuery.error.message} onRetry={() => void listQuery.refetch()} />
      )}
      {listQuery.data && listQuery.data.items.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No queries match these filters" : "No queries yet"}
          description={
            hasActiveFilters
              ? "Loosen the score slider or status filter."
              : "Run the pipeline to discover what people ask AI assistants in this space."
          }
        />
      )}
      {listQuery.data && listQuery.data.items.length > 0 && (
        <>
          <QueryTable
            queries={listQuery.data.items}
            checkingIds={checkingIds}
            onRecheck={recheck}
          />
          <PaginationControls pagination={listQuery.data.pagination} />
        </>
      )}
    </div>
  )
}
