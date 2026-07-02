export type Intent = "transactional" | "commercial" | "informational"
export type VisibilityStatus = "visible" | "not_visible" | "unknown"
export type RunStatus = "running" | "completed" | "failed" | "pending"
export type Priority = "high" | "medium" | "low"
export type ContentType =
  | "blog_post" | "landing_page" | "faq" | "comparison_page" | "guide"

export interface Profile {
  profile_uuid: string
  name: string
  domain: string
  industry: string
  description: string
  competitors: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface ProfileStats {
  total_queries: number
  avg_opportunity_score: number | null
  last_run_status: string | null
  last_run_at: string | null
}

export type ProfileWithStats = Profile & ProfileStats

export interface ProfileCreated {
  profile_uuid: string
  name: string
  domain: string
  status: string
  created_at: string
}

export interface ProfileCreateBody {
  name: string
  domain: string
  industry: string
  description: string
  competitors: string[]
}

export interface DiscoveredQuery {
  query_uuid: string
  profile_uuid: string
  run_uuid: string
  query_text: string
  keyword: string
  intent: Intent
  estimated_search_volume: number
  competitive_difficulty: number
  opportunity_score: number
  domain_visible: boolean | null
  visibility_position: number | null
  status: VisibilityStatus
  discovered_at: string
}

export interface Recommendation {
  recommendation_uuid: string
  target_query_uuid: string
  run_uuid: string
  content_type: ContentType
  title: string
  rationale: string
  target_keywords: string[]
  priority: Priority
  created_at: string
}

export interface PipelineRun {
  run_uuid: string
  profile_uuid: string
  status: RunStatus
  queries_discovered: number
  queries_scored: number
  tokens_used: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface RunPayload extends PipelineRun {
  top_queries: DiscoveredQuery[]
  recommendations: Recommendation[]
}

export interface RunAccepted {
  run_uuid: string
  status: "running"
  poll: string
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

export interface QueryListParams {
  min_score?: number
  status?: VisibilityStatus
  page?: number
  per_page?: number
}
