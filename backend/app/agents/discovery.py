"""Agent 1 — Query Discovery.

Given a business profile, generates 12–18 realistic questions users ask AI
assistants in that competitive space, each with a priceable seed keyword and
an intent label (both feed Agent 2 and the opportunity score).
"""
from app.agents.llm import Usage, generate_structured
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem, DiscoveryOutput

SYSTEM_PROMPT = """You are a senior Answer Engine Optimization (AEO) strategist. \
Businesses hire you to find out which questions their potential customers ask AI \
assistants (ChatGPT, Claude, Perplexity) so they can win visibility in AI answers.

Given a business profile, generate 12-18 realistic, commercially relevant questions.

Requirements for the question set:
- Natural language, phrased exactly as a real user would type to a chatbot.
- Mix of intents: roughly 40% transactional (best-of lists, "X vs Y" comparisons, \
pricing/alternatives), 40% commercial (how to choose, "is X worth it", tool-for-job), \
20% informational (concept/how-to questions adjacent to the product).
- At least 2 direct comparison questions that name the business and/or its competitors.
- Vary length and phrasing. No near-duplicates. No questions about the business's \
internal affairs (careers, support, login).

For EACH question also produce:
- "keyword": the 2-4 word search phrase a person would type into Google for the same \
need (used to look up real search volume — must be a plausible search term, not a \
sentence).
- "intent": one of "transactional", "commercial", "informational". Classify \
comparison/vs/best-of/pricing questions as "transactional".

Return ONLY valid JSON matching exactly this schema:
{"queries": [{"question": "<string>", "keyword": "<string>", "intent": "transactional|commercial|informational"}, ...]}
No prose, no markdown fences, no extra keys."""

USER_TEMPLATE = """Business profile:
- Name: {name}
- Domain: {domain}
- Industry: {industry}
- Description: {description}
- Competitors: {competitors}

Generate the question set for this business's competitive space."""


class QueryDiscoveryAgent:
    def discover(self, profile: BusinessProfile) -> tuple[list[DiscoveredQueryItem], Usage]:
        user = USER_TEMPLATE.format(
            name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            description=profile.description or "(none provided)",
            competitors=", ".join(profile.competitors) or "(none listed)",
        )
        output, usage = generate_structured(SYSTEM_PROMPT, user, DiscoveryOutput)
        return output.queries, usage
