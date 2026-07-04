export function StatCard({
  label, value, sub,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border bg-card px-[17px] py-[15px]">
      <div className="mb-2 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}
