import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STYLES: Record<string, string> = {
  visible: "bg-success/15 text-success border-success/30",
  not_visible: "bg-destructive/15 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground border-border",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  running: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  pending: "bg-muted text-muted-foreground border-border",
  created: "bg-muted text-muted-foreground border-border",
  analyzed: "bg-success/15 text-success border-success/30",
}

const LABELS: Record<string, string> = {
  visible: "Visible",
  not_visible: "Not visible",
  unknown: "Unknown",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", STYLES[status] ?? STYLES.unknown)}>
      {LABELS[status] ?? status}
    </Badge>
  )
}
