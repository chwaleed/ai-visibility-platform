import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  if (current > 3) pages.push("…")
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push("…")
  pages.push(total)
  return pages
}

const cellCls = "flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs"

/** Design-styled numbered pager: ‹ 1 … n ›. Renders nothing for a single page. */
export function Pager({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={cn(cellCls, "border border-border bg-card text-muted-foreground disabled:opacity-40")}
      >
        <ChevronLeft className="size-3.5" />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className={cn(cellCls, "text-muted-foreground")}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(
              cellCls,
              p === page
                ? "bg-primary font-medium text-primary-foreground"
                : "border border-border bg-card text-secondary-foreground hover:bg-muted",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className={cn(cellCls, "border border-border bg-card text-muted-foreground disabled:opacity-40")}
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}
