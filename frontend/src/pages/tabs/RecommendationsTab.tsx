import { ChevronDown, Lightbulb } from "lucide-react"
import { useState } from "react"
import { Pager } from "@/components/Pager"
import { SectionHeading } from "@/components/SectionHeading"
import { Pill, type Tone } from "@/components/StatusBadge"
import { EmptyState } from "@/components/states/EmptyState"
import { ErrorState } from "@/components/states/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { RECS_PER_PAGE, useRecommendations } from "@/hooks/useRecommendations"
import type { Priority } from "@/types"

const CHIPS: { id: Priority | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
]

const PRIORITY_TONE: Record<Priority, Tone> = { high: "danger", medium: "warning", low: "neutral" }

export function RecommendationsTab({ profileUuid }: { profileUuid: string }) {
  const [prio, setPrio] = useState<Priority | "all">("all")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const { data, isPending, isError, error, refetch } = useRecommendations(
    profileUuid, prio === "all" ? undefined : prio, page,
  )

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />

  const { items, pagination } = data
  if (pagination.total === 0 && prio === "all") {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Run the pipeline — recommendations target the queries where this domain is absent from AI answers."
      />
    )
  }

  const start = (pagination.page - 1) * RECS_PER_PAGE

  return (
    <div className="space-y-3.5">
      <SectionHeading
        icon={Lightbulb}
        title="Content recommendations"
        description="Where this domain is absent from AI answers"
      />
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(c => (
          <button
            key={c.id}
            onClick={() => { setPrio(c.id); setPage(1) }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              prio === c.id
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border bg-card text-secondary-foreground hover:bg-muted",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-9 text-center text-[13px] text-muted-foreground">
          No recommendations at this priority.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-1.5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left text-muted-foreground/90">
                  <th className="px-3 py-2.5 font-medium">Recommendation</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Priority</th>
                  <th className="w-9 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map(rec => {
                  const isOpen = open.has(rec.recommendation_uuid)
                  return (
                    <FragmentRow
                      key={rec.recommendation_uuid}
                      isOpen={isOpen}
                      onToggle={() => toggle(rec.recommendation_uuid)}
                      priority={rec.priority}
                      title={rec.title}
                      contentType={rec.content_type}
                      rationale={rec.rationale}
                      keywords={rec.target_keywords}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 pt-3 pb-2">
            <span className="text-xs text-muted-foreground">
              Showing {start + 1}–{Math.min(start + RECS_PER_PAGE, pagination.total)} of {pagination.total}
            </span>
            <Pager page={pagination.page} totalPages={pagination.total_pages} onPage={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}

function FragmentRow({
  isOpen, onToggle, priority, title, contentType, rationale, keywords,
}: {
  isOpen: boolean
  onToggle: () => void
  priority: Priority
  title: string
  contentType: string
  rationale: string
  keywords: string[]
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-t border-muted hover:bg-muted/40">
        <td className="max-w-[360px] px-3 py-3">
          <div className={cn("font-medium text-foreground", !isOpen && "truncate")}>{title}</div>
        </td>
        <td className="px-3 py-3 text-secondary-foreground capitalize">
          {contentType.replace(/_/g, " ")}
        </td>
        <td className="px-3 py-3 text-right">
          <Pill tone={PRIORITY_TONE[priority]}>{priority}</Pill>
        </td>
        <td className="px-3 py-3 text-center">
          <button
            aria-label={isOpen ? "Collapse" : "Expand"}
            aria-expanded={isOpen}
            onClick={e => { e.stopPropagation(); onToggle() }}
            className="text-muted-foreground transition-transform hover:text-primary"
          >
            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-muted bg-muted/30">
          <td colSpan={4} className="px-3 pt-1 pb-4">
            <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">{rationale}</p>
            {keywords.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {keywords.map(k => (
                  <span
                    key={k}
                    className="rounded-md border border-border bg-secondary/60 px-2.5 py-[3px] text-[11px] text-secondary-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
