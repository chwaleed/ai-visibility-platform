import { X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export function CompetitorsInput({
  value, onChange,
}: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("")

  function commit() {
    const domain = draft.trim().toLowerCase()
    if (domain && !value.includes(domain)) onChange([...value, domain])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        placeholder="competitor.com — press Enter to add"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(c => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                onClick={() => onChange(value.filter(v => v !== c))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
