from app.agents import discovery
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.llm import Usage
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem, DiscoveryOutput


def test_discover_returns_items_and_usage(app, monkeypatch):
    fake = DiscoveryOutput(queries=[
        DiscoveredQueryItem(question=f"Question {i}?", keyword=f"kw {i}",
                            intent="commercial")
        for i in range(12)
    ])
    captured: dict = {}

    def fake_generate(system, user, schema, **kw):
        captured["system"], captured["user"] = system, user
        return fake, Usage(100, 400)

    monkeypatch.setattr(discovery, "generate_structured", fake_generate)

    profile = BusinessProfile(
        name="Frase", domain="frase.io", industry="SEO Content Tools",
        description="AI briefs", competitors=["surferseo.com"],
    )
    items, usage = QueryDiscoveryAgent().discover(profile)

    assert len(items) == 12
    assert usage.total == 500
    # profile data must be substituted into the user prompt
    assert "frase.io" in captured["user"] and "surferseo.com" in captured["user"]
    # system prompt must define the output contract
    assert "JSON" in captured["system"] and "keyword" in captured["system"]
