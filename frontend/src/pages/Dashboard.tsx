import { Building2, Plus, Search, Target } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Pager } from "@/components/Pager"
import { ProfileCard } from "@/components/ProfileCard"
import { StatCard } from "@/components/StatCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"

const PAGE_SIZE = 9   // 3×3 card grid per page

export default function Dashboard() {
  const { data, isPending, isError, error, refetch } = useProfiles()
  const [page, setPage] = useState(1)

  const items = data?.items ?? []
  const totalQueries = items.reduce((a, p) => a + p.total_queries, 0)
  const scored = items.filter(p => p.avg_opportunity_score != null)
  const avgScore = scored.length
    ? (scored.reduce((a, p) => a + (p.avg_opportunity_score ?? 0), 0) / scored.length).toFixed(2)
    : "—"
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const paged = items.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-semibold tracking-[-0.02em]">Business Profiles</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Track how visible each brand is across AI-generated answers.
          </p>
        </div>
        <Button render={<Link to="/profiles/new" />}>
          <Plus className="size-4" /> New Profile
        </Button>
      </div>

      {isPending && (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[78px] rounded-[14px]" />)}
          </div>
          <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[168px] rounded-2xl" />)}
          </div>
        </>
      )}

      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}

      {data && items.length === 0 && (
        <EmptyState
          title="No profiles yet"
          description="Register a business to discover how visible it is in AI-generated answers."
          action={
            <Button render={<Link to="/profiles/new" />}>
              <Plus className="size-4" /> Create your first profile
            </Button>
          }
        />
      )}

      {data && items.length > 0 && (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <StatCard label="Profiles" value={items.length} icon={Building2} />
            <StatCard label="Queries tracked" value={totalQueries.toLocaleString()} icon={Search} />
            <StatCard label="Avg opportunity" value={avgScore} icon={Target} />
          </div>
          <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {paged.map(p => <ProfileCard key={p.profile_uuid} profile={p} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs text-muted-foreground">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} of {items.length}
              </span>
              <Pager page={safePage} totalPages={totalPages} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
