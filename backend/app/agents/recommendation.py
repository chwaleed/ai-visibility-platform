"""Agent 3 — Content Recommendations.

Input: the top-scoring queries where the target domain is NOT visible.
Output: 3-5 concrete content pieces that close those gaps.
"""
from dataclasses import dataclass

from app.agents.llm import Usage, generate_structured
from app.models import BusinessProfile
from app.schemas.agent_outputs import RecommendationItem, RecommendationOutput

SYSTEM_PROMPT = """You are a content strategist specializing in AI-answer visibility \
(AEO/GEO). A business is NOT being mentioned when AI assistants answer high-value \
questions in its space. Your job: recommend 3-5 specific content pieces that would \
make AI assistants start citing this business for those questions.

Rules:
- Each recommendation targets exactly ONE of the provided queries; set \
"target_query_uuid" to that query's uuid VERBATIM (copy it exactly).
- "title": a concrete, publishable title (not a topic label).
- "rationale": 1-3 sentences on WHY this content closes the visibility gap for that \
specific query.
- "target_keywords": 3-6 keywords/phrases the content must cover.
- "content_type": one of "blog_post", "landing_page", "faq", "comparison_page", "guide".
- "priority": "high" for the biggest opportunity scores, "medium"/"low" accordingly.
- Prefer comparison content for vs/alternative queries; guides for how-to queries.

Return ONLY valid JSON matching exactly:
{"recommendations": [{"target_query_uuid": "<uuid>", "content_type": "...", \
"title": "...", "rationale": "...", "target_keywords": ["..."], "priority": "high|medium|low"}, ...]}
No prose, no markdown fences, no extra keys."""

USER_TEMPLATE = """Business: {name} ({domain}), industry: {industry}.

High-opportunity queries where this business is currently ABSENT from AI answers
(sorted by opportunity, highest first):
{gaps}

Produce 3-5 content recommendations."""


@dataclass
class GapQuery:
    query_uuid: str
    question: str
    keyword: str
    opportunity_score: float


class ContentRecommendationAgent:
    def recommend(
        self, profile: BusinessProfile, gaps: list[GapQuery],
    ) -> tuple[list[RecommendationItem], Usage]:
        gap_lines = "\n".join(
            f'- uuid: {g.query_uuid} | score: {g.opportunity_score} | '
            f'question: "{g.question}" | keyword: {g.keyword}'
            for g in gaps
        )
        user = USER_TEMPLATE.format(
            name=profile.name, domain=profile.domain,
            industry=profile.industry, gaps=gap_lines,
        )
        output, usage = generate_structured(SYSTEM_PROMPT, user, RecommendationOutput)

        # Guard: model must reference provided uuids; reassign any hallucinated one.
        valid = {g.query_uuid for g in gaps}
        for i, rec in enumerate(output.recommendations):
            if rec.target_query_uuid not in valid:
                rec.target_query_uuid = gaps[i % len(gaps)].query_uuid
        return output.recommendations, usage
