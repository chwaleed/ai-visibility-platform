export function ScoreBar({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 1)
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        className="h-1.5 w-[70px] overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className="text-[12.5px] font-medium tabular-nums text-secondary-foreground">{clamped.toFixed(2)}</span>
    </div>
  )
}
