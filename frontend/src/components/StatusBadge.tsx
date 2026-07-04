import { cn } from "@/lib/utils"

export type Tone = "success" | "danger" | "warning" | "neutral" | "primary"

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
}

/** Design pill: 11px / 500, rounded-full, soft-tinted background. */
export function Pill({
  tone = "neutral", className, children,
}: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, Tone> = {
  visible: "success", completed: "success", analyzed: "success",
  not_visible: "danger", failed: "danger",
  running: "warning",
  unknown: "neutral", created: "neutral", pending: "neutral",
}

const STATUS_LABEL: Record<string, string> = {
  visible: "Visible", not_visible: "Not visible", unknown: "Unknown",
  completed: "Completed", failed: "Failed", running: "Running",
  pending: "Pending", analyzed: "Analyzed", created: "Not run",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={STATUS_TONE[status] ?? "neutral"}>
      {STATUS_LABEL[status] ?? status}
    </Pill>
  )
}
