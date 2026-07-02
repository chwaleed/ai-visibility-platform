from app.agents.llm import AgentError, Usage
from app.agents.scoring import ScoredQuery
from app.extensions import db
from app.models import BusinessProfile, ContentRecommendation, DiscoveredQuery
from app.schemas.agent_outputs import (
    DiscoveredQueryItem,
    RecommendationItem,
)
from app.services import pipeline
from app.services.pipeline import build_run_payload, execute_pipeline, start_run


def _profile():
    p = BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                        description="", competitors=["surferseo.com"])
    db.session.add(p)
    db.session.commit()
    return p


def _stub_agents(monkeypatch, n_queries=4, fail_recs=False):
    items = [DiscoveredQueryItem(question=f"Q{i}?", keyword=f"kw{i}",
                                 intent="commercial") for i in range(n_queries)]
    monkeypatch.setattr(pipeline.QueryDiscoveryAgent, "discover",
                        lambda self, prof: (items, Usage(100, 200)))

    def fake_score(self, prof, its):
        return [
            ScoredQuery(question=i.question, keyword=i.keyword, intent=i.intent,
                        volume=1000, difficulty=40,
                        visible=(idx % 2 == 0),            # half visible, half not
                        position=1 if idx % 2 == 0 else None,
                        opportunity_score=0.5 + idx * 0.1)
            for idx, i in enumerate(its)
        ], Usage(50, 50)

    monkeypatch.setattr(pipeline.VisibilityScoringAgent, "score_all", fake_score)

    def fake_recommend(self, prof, gaps):
        if fail_recs:
            raise AgentError("agent 3 down")
        return [
            RecommendationItem(target_query_uuid=gaps[0].query_uuid,
                               content_type="blog_post", title="T", rationale="R",
                               target_keywords=["k"], priority="high"),
            RecommendationItem(target_query_uuid=gaps[0].query_uuid,
                               content_type="faq", title="T2", rationale="R2",
                               target_keywords=["k"], priority="medium"),
            RecommendationItem(target_query_uuid=gaps[-1].query_uuid,
                               content_type="guide", title="T3", rationale="R3",
                               target_keywords=["k"], priority="low"),
        ], Usage(30, 70)

    monkeypatch.setattr(pipeline.ContentRecommendationAgent, "recommend",
                        fake_recommend)


def test_full_run_persists_everything(app, monkeypatch):
    _stub_agents(monkeypatch)
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "completed"
    assert run.queries_discovered == 4
    assert run.queries_scored == 4
    assert run.tokens_used == 100 + 200 + 50 + 50 + 30 + 70
    assert run.completed_at is not None
    assert DiscoveredQuery.query.count() == 4
    assert ContentRecommendation.query.count() == 3
    db.session.refresh(p)
    assert p.status == "analyzed"

    payload = build_run_payload(run)
    assert payload["status"] == "completed"
    assert len(payload["top_queries"]) == 3
    scores = [q["opportunity_score"] for q in payload["top_queries"]]
    assert scores == sorted(scores, reverse=True)
    assert len(payload["recommendations"]) == 3


def test_agent3_failure_still_completes_run(app, monkeypatch):
    _stub_agents(monkeypatch, fail_recs=True)
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "completed"                 # queries still valuable
    assert "recommendation" in (run.error_message or "").lower()
    assert ContentRecommendation.query.count() == 0


def test_agent1_failure_fails_run(app, monkeypatch):
    monkeypatch.setattr(pipeline.QueryDiscoveryAgent, "discover",
                        lambda self, prof: (_ for _ in ()).throw(AgentError("boom")))
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "failed"
    assert "boom" in run.error_message
    assert DiscoveredQuery.query.count() == 0
