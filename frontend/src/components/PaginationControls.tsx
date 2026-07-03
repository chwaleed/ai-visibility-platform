import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useQueryFilters } from "@/stores/queryFilters"
import type { Pagination } from "@/types"

export function PaginationControls({ pagination }: { pagination: Pagination }) {
  const { page, perPage, setPage, setPerPage } = useQueryFilters()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {pagination.total} queries · page {pagination.page} of {pagination.total_pages}
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(perPage)} onValueChange={v => setPerPage(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map(n => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline" size="icon" aria-label="Previous page"
          disabled={page <= 1} onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline" size="icon" aria-label="Next page"
          disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
