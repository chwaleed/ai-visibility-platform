"""Agent 3 — Content Recommendations.

Input: the top-scoring queries where the target domain is NOT visible.
Output: 3-5 concrete content pieces that close those gaps.
"""
from dataclasses import dataclass

from app.agents.llm import Usage, generate_structured
from app.agents.prompts import RECOMMENDATION_SYSTEM, RECOMMENDATION_USER
from app.models import BusinessProfile
from app.schemas.agent_outputs import RecommendationItem, RecommendationOutput


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
        user = RECOMMENDATION_USER.format(
            name=profile.name, domain=profile.domain,
            industry=profile.industry, gaps=gap_lines,
        )
        output, usage = generate_structured(RECOMMENDATION_SYSTEM, user, RecommendationOutput)

        # Guard: model must reference provided uuids; reassign any hallucinated one.
        valid = {g.query_uuid for g in gaps}
        for i, rec in enumerate(output.recommendations):
            if rec.target_query_uuid not in valid:
                rec.target_query_uuid = gaps[i % len(gaps)].query_uuid
        return output.recommendations, usage
