from app.agents import recommendation
from app.agents.llm import Usage
from app.agents.recommendation import ContentRecommendationAgent, GapQuery
from app.models import BusinessProfile
from app.schemas.agent_outputs import RecommendationItem, RecommendationOutput


def _gaps():
    return [
        GapQuery(query_uuid="uuid-1", question="Best AI brief tool?",
                 keyword="ai brief tool", opportunity_score=0.9),
        GapQuery(query_uuid="uuid-2", question="Frase vs Surfer?",
                 keyword="frase vs surfer", opportunity_score=0.8),
    ]


def _recs(uuids):
    return RecommendationOutput(recommendations=[
        RecommendationItem(target_query_uuid=u, content_type="blog_post",
                           title=f"T{i}", rationale="R", target_keywords=["k"],
                           priority="high")
        for i, u in enumerate(uuids)
    ])


def test_recommend_passes_gaps_and_returns_items(app, monkeypatch):
    captured = {}

    def fake(system, user, schema, **kw):
        captured["user"] = user
        return _recs(["uuid-1", "uuid-2", "uuid-1"]), Usage(50, 100)

    monkeypatch.setattr(recommendation, "generate_structured", fake)
    profile = BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                              description="", competitors=[])
    items, usage = ContentRecommendationAgent().recommend(profile, _gaps())
    assert len(items) == 3
    assert usage.total == 150
    assert "uuid-1" in captured["user"]          # uuids provided to the model


def test_invalid_uuid_reassigned_to_valid_gap(app, monkeypatch):
    monkeypatch.setattr(
        recommendation, "generate_structured",
        lambda *a, **k: (_recs(["made-up-uuid", "uuid-2", "also-bad"]), Usage(1, 1)),
    )
    profile = BusinessProfile(name="F", domain="frase.io", industry="S",
                              description="", competitors=[])
    items, _ = ContentRecommendationAgent().recommend(profile, _gaps())
    valid = {"uuid-1", "uuid-2"}
    assert all(r.target_query_uuid in valid for r in items)
