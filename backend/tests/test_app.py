def test_factory_creates_app(app):
    assert app.testing


def test_unknown_route_returns_error_envelope(client):
    res = client.get("/api/v1/nope")
    assert res.status_code == 404
    body = res.get_json()
    assert body["error"]["code"] == "not_found"
    assert "message" in body["error"]
