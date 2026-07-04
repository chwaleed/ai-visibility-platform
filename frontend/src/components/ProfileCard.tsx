import { Link } from "react-router"
import { StatusBadge } from "@/components/StatusBadge"
import type { ProfileWithStats } from "@/types"

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-[15px] font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  )
}

export function ProfileCard({ profile }: { profile: ProfileWithStats }) {
  const avg = profile.avg_opportunity_score
  const oppPct = avg != null ? Math.round(avg * 100) : 0
  const lastRun = profile.last_run_at
    ? `Last run ${new Date(profile.last_run_at).toLocaleDateString()}`
    : "No runs yet"

  return (
    <Link
      to={`/profiles/${profile.profile_uuid}`}
      className="block rounded-2xl border border-border bg-card px-5 py-[18px] transition-all hover:border-accent-border hover:shadow-[0_2px_10px_rgba(76,44,180,0.06)]"
    >
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15.5px] font-semibold tracking-[-0.01em]">{profile.name}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {profile.domain} · {profile.industry}
          </div>
        </div>
        {profile.last_run_status && <StatusBadge status={profile.last_run_status} />}
      </div>

      <div className="mb-3.5 grid grid-cols-3 gap-2.5">
        <MiniStat label="Queries" value={String(profile.total_queries)} />
        <MiniStat label="Avg score" value={avg != null ? avg.toFixed(2) : "—"} />
        <MiniStat label="Opportunity" value={avg != null ? `${oppPct}%` : "—"} accent />
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${oppPct}%` }} />
      </div>
      <div className="mt-2.5 text-[11px] text-muted-foreground/80">{lastRun}</div>
    </Link>
  )
}
