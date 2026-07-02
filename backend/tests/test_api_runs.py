import time

from app.services import pipeline as pipeline_service

VALID = {"name": "Frase", "domain": "frase.io", "industry": "SEO",
         "description": "", "competitors": []}


def _fake_execute(profile_uuid, run_uuid):
    """Stands in for the real pipeline: marks the run completed."""
    from datetime import datetime, timezone

    from app.extensions import db
    from app.models import PipelineRun

    run = db.session.get(PipelineRun, run_uuid)
    run.status = "completed"
    run.queries_discovered = 5
    run.queries_scored = 5
    run.tokens_used = 1234
    run.completed_at = datetime.now(timezone.utc)
    db.session.commit()


def test_sync_run_returns_full_payload(client, monkeypatch):
    monkeypatch.setattr("app.api.profiles.execute_pipeline", _fake_execute)
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    res = client.post(f"/api/v1/profiles/{uuid}/run")
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "completed"
    assert body["queries_discovered"] == 5
    assert body["tokens_used"] == 1234
    assert "top_queries" in body and "recommendations" in body


def test_async_run_returns_202_then_polls(client, app, monkeypatch):
    monkeypatch.setattr("app.api.profiles.execute_pipeline", _fake_execute)
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    res = client.post(f"/api/v1/profiles/{uuid}/run?async=1")
    assert res.status_code == 202
    body = res.get_json()
    run_uuid = body["run_uuid"]
    assert body["status"] == "running"

    deadline = time.time() + 5
    status = None
    while time.time() < deadline:
        poll = client.get(f"/api/v1/runs/{run_uuid}").get_json()
        status = poll["status"]
        if status == "completed":
            break
        time.sleep(0.05)
    assert status == "completed"


def test_run_on_missing_profile_404(client):
    assert client.post("/api/v1/profiles/nope/run").status_code == 404


def test_run_history(client, monkeypatch):
    monkeypatch.setattr("app.api.profiles.execute_pipeline", _fake_execute)
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    client.post(f"/api/v1/profiles/{uuid}/run")
    res = client.get(f"/api/v1/profiles/{uuid}/runs")
    assert res.status_code == 200
    assert len(res.get_json()["items"]) == 1
