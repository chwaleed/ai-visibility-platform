import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Small tinted icon square used to lead a section/card title. */
export function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground", className)}>
      <Icon className="size-3.5" />
    </span>
  )
}

/** Panel header — icon badge + title (+ optional description), used above bare table/card sections. */
export function SectionHeading({
  icon, title, description,
}: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5 px-1">
      <IconBadge icon={icon} />
      <div>
        <h3 className="text-[14.5px] font-semibold leading-tight">{title}</h3>
        {description && <p className="text-[12px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
