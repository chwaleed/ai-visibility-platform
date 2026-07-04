import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ErrorState({
  title = "Couldn't load this data", message, onRetry,
}: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/25 bg-card px-6 py-12 text-center">
      <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <TriangleAlert className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted-foreground">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button onClick={onRetry}>Retry</Button>
        </div>
      )}
    </div>
  )
}
