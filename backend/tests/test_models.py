from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)


def _profile() -> BusinessProfile:
    p = BusinessProfile(
        name="Frase",
        domain="frase.io",
        industry="SEO Content Tools",
        description="AI content briefs",
        competitors=["surferseo.com", "clearscope.io"],
    )
    db.session.add(p)
    db.session.commit()
    return p


def test_profile_defaults_and_dict(app):
    p = _profile()
    assert len(p.uuid) == 36
    assert p.status == "created"
    d = p.to_dict()
    assert d["profile_uuid"] == p.uuid
    assert d["competitors"] == ["surferseo.com", "clearscope.io"]
    assert d["created_at"].endswith("Z")


def test_query_status_derivation(app):
    p = _profile()
    run = PipelineRun(profile_uuid=p.uuid)
    db.session.add(run)
    db.session.commit()
    q = DiscoveredQuery(
        profile_uuid=p.uuid,
        run_uuid=run.uuid,
        query_text="best seo tool?",
        keyword="best seo tool",
        intent="transactional",
    )
    db.session.add(q)
    db.session.commit()
    assert q.status == "unknown"          # domain_visible is NULL
    q.domain_visible = False
    assert q.status == "not_visible"
    q.domain_visible = True
    assert q.status == "visible"


def test_relationships_cascade(app):
    p = _profile()
    run = PipelineRun(profile_uuid=p.uuid, status="completed")
    db.session.add(run)
    db.session.commit()
    q = DiscoveredQuery(
        profile_uuid=p.uuid, run_uuid=run.uuid, query_text="q", keyword="k",
        intent="commercial",
    )
    db.session.add(q)
    db.session.commit()
    r = ContentRecommendation(
        profile_uuid=p.uuid, query_uuid=q.uuid, run_uuid=run.uuid,
        content_type="blog_post", title="T", rationale="R",
        target_keywords=["a", "b"], priority="high",
    )
    db.session.add(r)
    db.session.commit()
    assert p.queries[0].uuid == q.uuid
    assert p.runs[0].uuid == run.uuid
    assert r.to_dict()["target_query_uuid"] == q.uuid
