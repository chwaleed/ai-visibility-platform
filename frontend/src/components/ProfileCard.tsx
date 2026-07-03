import { Link } from "react-router"
import { StatusBadge } from "@/components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfileWithStats } from "@/types"

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}

export function ProfileCard({ profile }: { profile: ProfileWithStats }) {
  return (
    <Link to={`/profiles/${profile.profile_uuid}`} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{profile.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{profile.domain}</p>
          </div>
          {profile.last_run_status && <StatusBadge status={profile.last_run_status} />}
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          <Stat label="Industry" value={<span className="line-clamp-1">{profile.industry}</span>} />
          <Stat label="Queries" value={profile.total_queries} />
          <Stat
            label="Avg score"
            value={profile.avg_opportunity_score?.toFixed(2) ?? "—"}
          />
        </CardContent>
      </Card>
    </Link>
  )
}
