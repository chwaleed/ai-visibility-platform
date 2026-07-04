import { Plus } from "lucide-react"
import { Link } from "react-router"
import { ProfileCard } from "@/components/ProfileCard"
import { StatCard } from "@/components/StatCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"

export default function Dashboard() {
  const { data, isPending, isError, error, refetch } = useProfiles()

  const items = data?.items ?? []
  const totalQueries = items.reduce((a, p) => a + p.total_queries, 0)
  const scored = items.filter(p => p.avg_opportunity_score != null)
  const avgScore = scored.length
    ? (scored.reduce((a, p) => a + (p.avg_opportunity_score ?? 0), 0) / scored.length).toFixed(2)
    : "—"

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
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
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
            <StatCard label="Profiles" value={items.length} />
            <StatCard label="Queries tracked" value={totalQueries.toLocaleString()} />
            <StatCard label="Avg opportunity" value={avgScore} />
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {items.map(p => <ProfileCard key={p.profile_uuid} profile={p} />)}
          </div>
        </>
      )}
    </div>
  )
}
