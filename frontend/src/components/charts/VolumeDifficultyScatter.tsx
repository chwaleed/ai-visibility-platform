import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume vs difficulty</CardTitle>
        <CardDescription>Top-left = high demand, low competition (best gaps)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <ScatterChart margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="difficulty" name="Difficulty" domain={[0, 100]}
              tickLine={false} axisLine={false} fontSize={11}
              label={{ value: "difficulty", position: "insideBottom", offset: -4, fontSize: 11 }}
            />
            <YAxis
              type="number" dataKey="volume" name="Volume"
              tickLine={false} axisLine={false} fontSize={11} width={70}
            />
            <ZAxis type="number" dataKey="score" range={[40, 200]} name="Score" />
            <ChartTooltip content={<ChartTooltipContent />} />
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
      </CardContent>
    </Card>
  )
}
