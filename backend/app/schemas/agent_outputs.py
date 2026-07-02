"""Schemas the LLM must produce. Also spelled out inside the agent prompts —
the parse() call enforces them at the API layer; the prompt makes the
contract explicit to the model (and to assessment reviewers)."""
from typing import Literal

from pydantic import BaseModel, Field

Intent = Literal["transactional", "commercial", "informational"]
ContentType = Literal["blog_post", "landing_page", "faq", "comparison_page", "guide"]
Priority = Literal["high", "medium", "low"]


class DiscoveredQueryItem(BaseModel):
    question: str = Field(description="Natural-language question a user would ask an AI assistant")
    keyword: str = Field(description="2-4 word search phrase capturing the question's core topic")
    intent: Intent


class DiscoveryOutput(BaseModel):
    queries: list[DiscoveredQueryItem] = Field(min_length=1)


class RecommendationItem(BaseModel):
    target_query_uuid: str
    content_type: ContentType
    title: str
    rationale: str
    target_keywords: list[str] = Field(min_length=1, max_length=8)
    priority: Priority


class RecommendationOutput(BaseModel):
    recommendations: list[RecommendationItem] = Field(min_length=1)
