import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { DiscoveredQuery } from "@/types"

const config = {
  count: { label: "Queries", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ScoreDistribution({ queries }: { queries: DiscoveredQuery[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    count: 0,
  }))
  for (const q of queries) {
    const i = Math.min(Math.floor(q.opportunity_score * 10), 9)
    buckets[i].count += 1
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Opportunity score distribution</CardTitle>
        <CardDescription>Where this profile's {queries.length} queries fall</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={buckets} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
