import { Plus } from "lucide-react"
import { Link } from "react-router"
import { ProfileCard } from "@/components/ProfileCard"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"

export default function Dashboard() {
  const { data, isPending, isError, error, refetch } = useProfiles()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Business Profiles</h1>
        <Button render={<Link to="/profiles/new" />}>
          <Plus className="size-4" /> New Profile
        </Button>
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      )}

      {isError && <ErrorState message={error.message} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No profiles yet"
          description="Register a business to discover how visible it is in AI answers."
          action={
            <Button render={<Link to="/profiles/new" />}>
              <Plus className="size-4" /> Create your first profile
            </Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map(p => <ProfileCard key={p.profile_uuid} profile={p} />)}
        </div>
      )}
    </div>
  )
}
