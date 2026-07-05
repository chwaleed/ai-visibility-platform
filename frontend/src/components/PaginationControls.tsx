import { Pager } from "@/components/Pager"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useQueryFilters } from "@/stores/queryFilters"
import type { Pagination } from "@/types"

export function PaginationControls({ pagination }: { pagination: Pagination }) {
  const { perPage, setPage, setPerPage } = useQueryFilters()
  const { page, per_page, total, total_pages } = pagination
  const start = (page - 1) * per_page + 1
  const end = Math.min(page * per_page, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 pt-3 pb-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {total ? `Showing ${start}–${end} of ${total}` : "No matches"}
        </span>
        <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}>
          <SelectTrigger className="h-7 w-[104px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map(n => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pager page={page} totalPages={total_pages} onPage={setPage} />
    </div>
  )
}
