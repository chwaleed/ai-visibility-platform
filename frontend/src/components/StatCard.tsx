import type { LucideIcon } from "lucide-react"
import { IconBadge } from "@/components/SectionHeading"

export function StatCard({
  label, value, sub, icon,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-[17px] py-[15px]">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {icon && <IconBadge icon={icon} />}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}
