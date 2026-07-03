import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Recommendation } from "@/types"

const PRIORITY_STYLES: Record<Recommendation["priority"], string> = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-muted-foreground",
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card className={cn("border-l-4", PRIORITY_STYLES[rec.priority])}>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {rec.content_type.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className="capitalize">{rec.priority} priority</Badge>
        </div>
        <CardTitle className="text-base">{rec.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{rec.rationale}</p>
        <div className="flex flex-wrap gap-1.5">
          {rec.target_keywords.map(k => (
            <Badge key={k} variant="secondary" className="font-normal">{k}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
