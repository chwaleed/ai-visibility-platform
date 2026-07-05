import time

VALID = {"name": "Frase", "domain": "frase.io", "industry": "SEO",
         "description": "", "competitors": []}


def _fake_execute(profile_uuid: str, run_uuid: str) -> None:
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
    prof = client.get(f"/api/v1/profiles/{uuid}").get_json()
    assert prof["last_run_status"] == "completed"
    assert prof["last_run_at"] is not None


def test_run_history_is_paginated(client, monkeypatch):
    monkeypatch.setattr("app.api.profiles.execute_pipeline", _fake_execute)
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    for _ in range(3):
        client.post(f"/api/v1/profiles/{uuid}/run")
    body = client.get(f"/api/v1/profiles/{uuid}/runs?page=2&per_page=2").get_json()
    assert body["pagination"] == {"page": 2, "per_page": 2, "total": 3, "total_pages": 2}
    assert len(body["items"]) == 1


def test_recommendations_paginated_and_priority_validated(client):
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    body = client.get(f"/api/v1/profiles/{uuid}/recommendations").get_json()
    assert body["items"] == [] and body["pagination"]["total"] == 0
    res = client.get(f"/api/v1/profiles/{uuid}/recommendations?priority=urgent")
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "invalid_parameter"
