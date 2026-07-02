from app.agents import scoring
from app.agents.llm import Usage
from app.agents.scoring import (
    VisibilityScoringAgent,
    brand_variants,
    extract_visibility,
)
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem


def test_brand_variants():
    v = brand_variants("surferseo.com", "Surfer SEO")
    assert "surferseo.com" in v and "surferseo" in v and "surfer seo" in v


def test_extract_visibility_target_first():
    answer = "I'd recommend Frase for briefs; Surfer SEO is also popular."
    visible, pos = extract_visibility(
        answer, brand_variants("frase.io", "Frase"),
        [brand_variants("surferseo.com", None)],
    )
    assert visible is True and pos == 1


def test_extract_visibility_target_second():
    answer = "Surfer SEO leads the pack, though Frase is a solid alternative."
    visible, pos = extract_visibility(
        answer, brand_variants("frase.io", "Frase"),
        [brand_variants("surferseo.com", None)],
    )
    assert visible is True and pos == 2


def test_extract_visibility_absent():
    answer = "Surfer SEO and Clearscope are the main options."
    visible, pos = extract_visibility(
        answer, brand_variants("frase.io", "Frase"),
        [brand_variants("surferseo.com", None), brand_variants("clearscope.io", None)],
    )
    assert visible is False and pos is None


def test_brand_variants_has_no_generic_fragments():
    assert "surfer" not in brand_variants("surferseo.com", None)


def test_no_false_positive_on_generic_words():
    answer = "Great surfers recommend practicing daily near the sea."
    visible, pos = extract_visibility(
        answer, brand_variants("surferseo.com", None), [])
    assert visible is False and pos is None


def _profile() -> BusinessProfile:
    return BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                           description="", competitors=["surferseo.com"])


def _items(n=3):
    return [DiscoveredQueryItem(question=f"Q{i}?", keyword=f"kw{i}",
                                intent="commercial") for i in range(n)]


def test_score_all_happy_path(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_keyword_metrics",
                        lambda kws: ({k: 1000 for k in kws}, {k: 40 for k in kws}))
    monkeypatch.setattr(scoring, "generate_text",
                        lambda system, user, **kw: ("Frase is great.", Usage(10, 20)))

    scored, usage = VisibilityScoringAgent().score_all(_profile(), _items(3))
    assert len(scored) == 3
    assert all(s.visible is True for s in scored)
    assert all(0.0 <= s.opportunity_score <= 1.0 for s in scored)
    assert usage.total == 90  # 3 probes x 30


def test_score_all_probe_failure_marks_unknown_and_continues(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_keyword_metrics", lambda kws: ({}, {}))
    calls = {"n": 0}

    def flaky(system, user, **kw):
        calls["n"] += 1
        if "Q1?" in user:
            raise RuntimeError("probe exploded")
        return "Surfer SEO only.", Usage(10, 20)

    monkeypatch.setattr(scoring, "generate_text", flaky)

    scored, _ = VisibilityScoringAgent().score_all(_profile(), _items(3))
    assert len(scored) == 3                      # nothing dropped
    failed = next(s for s in scored if s.question == "Q1?")
    assert failed.visible is None and failed.position is None
    ok = next(s for s in scored if s.question == "Q0?")
    assert ok.visible is False
    # SE Ranking empty → neutral defaults applied
    assert ok.volume == 0 and ok.difficulty == 50


def test_probe_prompt_never_leaks_target(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_keyword_metrics", lambda kws: ({}, {}))
    seen = []

    def spy(system, user, **kw):
        seen.append((system, user))
        return "answer", Usage(1, 1)

    monkeypatch.setattr(scoring, "generate_text", spy)
    VisibilityScoringAgent().score_all(_profile(), _items(1))
    for system, user in seen:
        assert "frase" not in system.lower()      # no bias leakage
        assert "frase" not in user.lower()


def test_hyphenated_brand_mention_matches():
    visible, pos = extract_visibility(
        "Surfer-SEO is the leader.", brand_variants("surferseo.com", None), [])
    assert visible is True and pos == 1
