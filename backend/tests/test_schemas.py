import pytest
from pydantic import ValidationError

from app.schemas.agent_outputs import DiscoveryOutput, RecommendationOutput
from app.schemas.requests import ProfileCreate


def test_profile_create_valid():
    p = ProfileCreate(
        name="Frase", domain="Frase.io ", industry="SEO",
        description="x", competitors=["a.com", "b.com"],
    )
    assert p.domain == "frase.io"  # normalized


def test_profile_create_rejects_missing_fields():
    with pytest.raises(ValidationError):
        ProfileCreate(name="", domain="", industry="")


def test_discovery_output_parses():
    out = DiscoveryOutput.model_validate(
        {"queries": [{"question": "Best SEO tool?", "keyword": "best seo tool",
                      "intent": "transactional"}]}
    )
    assert out.queries[0].intent == "transactional"


def test_discovery_rejects_bad_intent():
    with pytest.raises(ValidationError):
        DiscoveryOutput.model_validate(
            {"queries": [{"question": "q", "keyword": "k", "intent": "navigational"}]}
        )


def test_recommendation_output_parses():
    out = RecommendationOutput.model_validate(
        {"recommendations": [{
            "target_query_uuid": "abc", "content_type": "blog_post",
            "title": "T", "rationale": "R", "target_keywords": ["k"],
            "priority": "high"}]}
    )
    assert out.recommendations[0].priority == "high"


def test_discovery_rejects_empty_queries():
    with pytest.raises(ValidationError):
        DiscoveryOutput.model_validate({"queries": []})


def test_recommendation_rejects_empty_list():
    with pytest.raises(ValidationError):
        RecommendationOutput.model_validate({"recommendations": []})
