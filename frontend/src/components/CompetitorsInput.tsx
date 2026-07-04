import { X } from "lucide-react"
import { useState } from "react"
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
    <div>
      {value.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {value.map(c => (
            <span
              key={c}
              className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent py-1 pr-1.5 pl-3 text-xs text-secondary-foreground"
            >
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                className="text-primary/70 hover:text-primary"
                onClick={() => onChange(value.filter(v => v !== c))}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Add a competitor and press Enter"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
        />
        <button
          type="button"
          onClick={commit}
          className="shrink-0 rounded-[9px] border border-accent-border bg-accent px-4 text-[13px] font-medium text-primary hover:bg-accent/70"
        >
          Add
        </button>
      </div>
    </div>
  )
}
