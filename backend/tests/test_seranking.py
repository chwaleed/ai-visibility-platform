from app.agents import seranking


def _payload():
    return [
        {"is_data_found": True, "keyword": "best seo tool", "volume": 1200,
         "difficulty": 62, "cpc": 3.1, "competition": 0.4},
        {"is_data_found": True, "keyword": "frase vs surfer seo", "volume": 300,
         "difficulty": 35, "cpc": 1.2, "competition": 0.2},
        {"is_data_found": False, "keyword": "no data kw", "volume": None,
         "difficulty": None, "cpc": None, "competition": None},
    ]


class _Resp:
    def __init__(self, payload, status=200):
        self._payload, self.status_code = payload, status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_fetch_keyword_metrics_happy_path(monkeypatch):
    monkeypatch.setattr(seranking, "_api_key", lambda: "test-key")
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["params"] = kwargs.get("params")
        captured["headers"] = kwargs.get("headers")
        captured["json"] = kwargs.get("json")
        return _Resp(_payload())

    monkeypatch.setattr(seranking.requests, "post", fake_post)
    volumes, difficulties = seranking.fetch_keyword_metrics(
        ["best seo tool", "frase vs surfer seo", "no data kw"])

    assert volumes == {"best seo tool": 1200, "frase vs surfer seo": 300,
                       "no data kw": 0}
    assert difficulties == {"best seo tool": 62, "frase vs surfer seo": 35,
                            "no data kw": 50}
    assert captured["url"] == seranking.EXPORT_URL
    assert captured["params"] == {"source": "us"}
    assert captured["headers"]["Authorization"] == "Token test-key"
    assert captured["json"] == {"keywords": ["best seo tool",
                                             "frase vs surfer seo", "no data kw"]}


def test_keys_normalized_so_mixed_case_lookups_hit(monkeypatch):
    # SE Ranking lowercases keywords in its response; a caller looking up the
    # original mixed-case keyword must still find the data (not fall to defaults).
    monkeypatch.setattr(seranking, "_api_key", lambda: "test-key")
    payload = [{"is_data_found": True, "keyword": "surfer seo", "volume": 6600, "difficulty": 67}]
    monkeypatch.setattr(seranking.requests, "post", lambda *a, **k: _Resp(payload))

    volumes, difficulties = seranking.fetch_keyword_metrics(["Surfer SEO"])
    assert volumes == {"surfer seo": 6600}
    assert volumes[seranking.normalize_keyword("Surfer SEO")] == 6600
    assert difficulties[seranking.normalize_keyword("Surfer SEO")] == 67


def test_http_failure_returns_empty(monkeypatch):
    monkeypatch.setattr(seranking, "_api_key", lambda: "test-key")
    monkeypatch.setattr(seranking.requests, "post", lambda *a, **k: _Resp({}, 500))
    assert seranking.fetch_keyword_metrics(["x"]) == ({}, {})


def test_missing_api_key_returns_empty(monkeypatch):
    monkeypatch.setattr(seranking, "_api_key", lambda: "")
    assert seranking.fetch_keyword_metrics(["x"]) == ({}, {})


def test_non_list_response_returns_empty(monkeypatch):
    monkeypatch.setattr(seranking, "_api_key", lambda: "test-key")
    monkeypatch.setattr(seranking.requests, "post",
                        lambda *a, **k: _Resp({"error": "unexpected shape"}))
    assert seranking.fetch_keyword_metrics(["x"]) == ({}, {})
