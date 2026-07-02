import pytest
from sqlalchemy.pool import StaticPool

from app import create_app
from app.extensions import db


@pytest.fixture()
def limited_client(monkeypatch):
    monkeypatch.setattr("app.api.profiles.execute_pipeline", lambda p, r: None)
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {"poolclass": StaticPool,
                                      "connect_args": {"check_same_thread": False}},
        "RATELIMIT_ENABLED": True,
    })
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()


def test_run_endpoint_rate_limited(limited_client):
    uuid = limited_client.post("/api/v1/profiles", json={
        "name": "F", "domain": "frase.io", "industry": "SEO",
    }).get_json()["profile_uuid"]

    statuses = [limited_client.post(f"/api/v1/profiles/{uuid}/run").status_code
                for _ in range(6)]
    assert statuses[-1] == 429
    body = limited_client.post(f"/api/v1/profiles/{uuid}/run").get_json()
    assert body["error"]["code"] == "rate_limited"
