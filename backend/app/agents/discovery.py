"""Agent 1 — Query Discovery.

Given a business profile, generates 12–18 realistic questions users ask AI
assistants in that competitive space, each with a priceable seed keyword and
an intent label (both feed Agent 2 and the opportunity score).
"""
from app.agents.llm import Usage, generate_structured
from app.agents.prompts import DISCOVERY_SYSTEM, DISCOVERY_USER
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem, DiscoveryOutput


class QueryDiscoveryAgent:
    def discover(self, profile: BusinessProfile) -> tuple[list[DiscoveredQueryItem], Usage]:
        user = DISCOVERY_USER.format(
            name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            description=profile.description or "(none provided)",
            competitors=", ".join(profile.competitors) or "(none listed)",
        )
        output, usage = generate_structured(DISCOVERY_SYSTEM, user, DiscoveryOutput)
        return output.queries, usage
