from app.agents.scoring import ScoredQuery
from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)

VALID = {"name": "Frase", "domain": "frase.io", "industry": "SEO",
         "description": "", "competitors": []}


def _seed(client):
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    run = PipelineRun(profile_uuid=uuid, status="completed")
    db.session.add(run)
    db.session.commit()
    rows = [
        DiscoveredQuery(profile_uuid=uuid, run_uuid=run.uuid, query_text=f"Q{i}?",
                        keyword=f"kw{i}", intent="commercial",
                        estimated_search_volume=i * 100,
                        competitive_difficulty=50,
                        opportunity_score=i / 10,
                        domain_visible=(None if i == 0 else i % 2 == 0))
        for i in range(5)  # scores 0.0..0.4; i=0 unknown
    ]
    db.session.add_all(rows)
    db.session.commit()
    return uuid, run, rows


def test_queries_sorted_desc_and_paginated(client):
    uuid, _, _ = _seed(client)
    res = client.get(f"/api/v1/profiles/{uuid}/queries?page=1&per_page=2")
    assert res.status_code == 200
    body = res.get_json()
    assert body["pagination"]["total"] == 5
    scores = [q["opportunity_score"] for q in body["items"]]
    assert scores == sorted(scores, reverse=True) and len(scores) == 2


def test_queries_min_score_filter(client):
    uuid, _, _ = _seed(client)
    body = client.get(f"/api/v1/profiles/{uuid}/queries?min_score=0.3").get_json()
    assert all(q["opportunity_score"] >= 0.3 for q in body["items"])
    assert body["pagination"]["total"] == 2


def test_queries_status_filter(client):
    uuid, _, _ = _seed(client)
    unknown = client.get(f"/api/v1/profiles/{uuid}/queries?status=unknown").get_json()
    assert unknown["pagination"]["total"] == 1
    not_visible = client.get(
        f"/api/v1/profiles/{uuid}/queries?status=not_visible").get_json()
    assert all(q["domain_visible"] is False for q in not_visible["items"])


def test_queries_invalid_status_400(client):
    uuid, _, _ = _seed(client)
    res = client.get(f"/api/v1/profiles/{uuid}/queries?status=banana")
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "invalid_parameter"


def test_recheck_updates_row(client, monkeypatch):
    uuid, _, rows = _seed(client)
    target = rows[0]

    def fake_single(self, profile, question, keyword, intent):
        return ScoredQuery(question=question, keyword=keyword, intent=intent,
                           volume=999, difficulty=10, visible=True, position=1,
                           opportunity_score=0.77)

    monkeypatch.setattr(
        "app.api.queries.VisibilityScoringAgent.score_single", fake_single)
    res = client.post(f"/api/v1/queries/{target.uuid}/recheck")
    assert res.status_code == 200
    body = res.get_json()
    assert body["domain_visible"] is True
    assert body["opportunity_score"] == 0.77
    assert body["estimated_search_volume"] == 999


def test_recommendations_endpoint(client):
    uuid, run, rows = _seed(client)
    db.session.add(ContentRecommendation(
        profile_uuid=uuid, query_uuid=rows[0].uuid, run_uuid=run.uuid,
        content_type="blog_post", title="T", rationale="R",
        target_keywords=["k"], priority="high"))
    db.session.commit()
    res = client.get(f"/api/v1/profiles/{uuid}/recommendations")
    assert res.status_code == 200
    items = res.get_json()["items"]
    assert items[0]["target_query_uuid"] == rows[0].uuid
    assert items[0]["priority"] == "high"
