import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useQueryFilters } from "@/stores/queryFilters"
import type { VisibilityStatus } from "@/types"

const ALL = "all"

export function QueryFilters() {
  const { minScore, status, setMinScore, setStatus } = useQueryFilters()
  return (
    <div className="flex flex-wrap items-end gap-6 rounded-lg border border-border bg-card p-4">
      <div className="w-56 space-y-2">
        <Label className="flex justify-between text-xs">
          <span>Min opportunity score</span>
          <span className="tabular-nums text-muted-foreground">{minScore.toFixed(2)}</span>
        </Label>
        <Slider
          value={[minScore]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={v => setMinScore(Array.isArray(v) ? v[0] : v)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Visibility</Label>
        <Select
          value={status ?? ALL}
          onValueChange={v => setStatus(v === ALL ? undefined : (v as VisibilityStatus))}
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
            <SelectItem value="not_visible">Not visible</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
