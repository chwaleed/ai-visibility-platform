import { Crosshair } from "lucide-react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
import { IconBadge } from "@/components/SectionHeading"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { DiscoveredQuery, VisibilityStatus } from "@/types"

const config = {
  visible: { label: "Visible", color: "var(--chart-2)" },
  not_visible: { label: "Not visible", color: "var(--chart-4)" },
  unknown: { label: "Unknown", color: "var(--chart-5)" },
} satisfies ChartConfig

const GROUPS: VisibilityStatus[] = ["not_visible", "visible", "unknown"]

const DOT: Record<VisibilityStatus, string> = {
  visible: "var(--chart-2)", not_visible: "var(--chart-4)", unknown: "var(--chart-5)",
}

const fmtK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))

export function VolumeDifficultyScatter({ queries }: { queries: DiscoveredQuery[] }) {
  const byStatus = (status: VisibilityStatus) =>
    queries
      .filter(q => q.status === status)
      .map(q => ({
        difficulty: q.competitive_difficulty,
        volume: q.estimated_search_volume,
        score: q.opportunity_score,
        name: q.query_text,
      }))

  return (
    <Card className="overflow-visible rounded-2xl border border-border ring-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-[14.5px]">
          <IconBadge icon={Crosshair} />
          Volume vs difficulty
        </CardTitle>
        <CardDescription>Top-left = high demand, low competition (best gaps)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[210px] w-full">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="difficulty" name="Difficulty" domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false}
              tick={{ fontSize: 10 }} tickMargin={6} height={20}
            />
            <YAxis
              type="number" dataKey="volume" name="Volume"
              tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={38}
              tickFormatter={fmtK}
            />
            <ZAxis type="number" dataKey="score" range={[40, 220]} name="Score" />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={<ChartTooltipContent nameKey="name" />}
            />
            {GROUPS.map(status => (
              <Scatter
                key={status}
                name={String(config[status].label)}
                data={byStatus(status)}
                fill={`var(--color-${status})`}
                fillOpacity={0.75}
              />
            ))}
          </ScatterChart>
        </ChartContainer>
        <div className="mt-2 text-center text-[10px] text-muted-foreground">competitive difficulty</div>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {GROUPS.map(status => (
            <span key={status} className="flex items-center gap-1.5 text-[11px] text-secondary-foreground">
              <span className="size-2.5 rounded-full" style={{ background: DOT[status] }} />
              {config[status].label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
