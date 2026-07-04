import { Target } from "lucide-react"

export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
        <Target className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
