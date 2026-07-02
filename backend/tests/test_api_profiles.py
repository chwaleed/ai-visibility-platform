VALID = {
    "name": "Frase", "domain": "frase.io", "industry": "SEO Content Tools",
    "description": "AI briefs", "competitors": ["surferseo.com"],
}


def test_create_profile_201_spec_shape(client):
    res = client.post("/api/v1/profiles", json=VALID)
    assert res.status_code == 201
    body = res.get_json()
    assert body["name"] == "Frase"
    assert body["domain"] == "frase.io"
    assert body["status"] == "created"
    assert "profile_uuid" in body and "created_at" in body


def test_create_profile_validation_400_envelope(client):
    res = client.post("/api/v1/profiles", json={"name": "", "domain": "x"})
    assert res.status_code == 400
    body = res.get_json()
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["details"], list)


def test_get_profile_with_stats(client):
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    res = client.get(f"/api/v1/profiles/{uuid}")
    assert res.status_code == 200
    body = res.get_json()
    assert body["total_queries"] == 0
    assert body["avg_opportunity_score"] is None
    assert body["last_run_status"] is None


def test_get_missing_profile_404(client):
    res = client.get("/api/v1/profiles/does-not-exist")
    assert res.status_code == 404
    assert res.get_json()["error"]["code"] == "not_found"


def test_list_profiles(client):
    client.post("/api/v1/profiles", json=VALID)
    res = client.get("/api/v1/profiles")
    assert res.status_code == 200
    assert len(res.get_json()["items"]) == 1
