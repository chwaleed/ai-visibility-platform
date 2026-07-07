import { BarChart3 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { IconBadge } from "@/components/SectionHeading"
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
    // short single-value tick keeps all 10 labels visible (ranges overlap and get dropped)
    range: (i / 10).toFixed(1),
    count: 0,
  }))
  for (const q of queries) {
    const i = Math.min(Math.floor(q.opportunity_score * 10), 9)
    buckets[i].count += 1
  }

  return (
    <Card className="overflow-visible rounded-2xl border border-border ring-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-[14.5px]">
          <IconBadge icon={BarChart3} />
          Opportunity score distribution
        </CardTitle>
        <CardDescription>Where this profile's {queries.length} queries fall</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
          <BarChart data={buckets} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="range" tickLine={false} axisLine={false}
              interval={0} tick={{ fontSize: 9 }} tickMargin={6}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 10 }} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={<ChartTooltipContent labelFormatter={l => `Score ${l}–${(Number(l) + 0.1).toFixed(1)}`} />}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[5, 5, 0, 0]}>
              <LabelList dataKey="count" position="top" className="fill-muted-foreground" fontSize={10} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
