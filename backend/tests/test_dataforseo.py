from app.agents import dataforseo


def _volume_payload():
    return {"tasks": [{"status_code": 20000, "result": [
        {"keyword": "best seo tool", "search_volume": 1200},
        {"keyword": "frase vs surfer", "search_volume": 300},
        {"keyword": "no volume kw", "search_volume": None},
    ]}]}


def _difficulty_payload():
    return {"tasks": [{"status_code": 20000, "result": [{"items": [
        {"keyword": "best seo tool", "keyword_difficulty": 62},
        {"keyword": "frase vs surfer", "keyword_difficulty": 35},
    ]}]}]}


class _Resp:
    def __init__(self, payload, status=200):
        self._payload, self.status_code = payload, status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_fetch_search_volumes(monkeypatch):
    monkeypatch.setattr(dataforseo, "_credentials", lambda: ("user", "pass"))
    monkeypatch.setattr(dataforseo.requests, "post",
                        lambda *a, **k: _Resp(_volume_payload()))
    volumes = dataforseo.fetch_search_volumes(["best seo tool", "frase vs surfer", "no volume kw"])
    assert volumes == {"best seo tool": 1200, "frase vs surfer": 300, "no volume kw": 0}


def test_fetch_difficulties(monkeypatch):
    monkeypatch.setattr(dataforseo, "_credentials", lambda: ("user", "pass"))
    monkeypatch.setattr(dataforseo.requests, "post",
                        lambda *a, **k: _Resp(_difficulty_payload()))
    diffs = dataforseo.fetch_difficulties(["best seo tool", "frase vs surfer"])
    assert diffs == {"best seo tool": 62, "frase vs surfer": 35}


def test_http_failure_returns_empty(monkeypatch):
    monkeypatch.setattr(dataforseo, "_credentials", lambda: ("user", "pass"))
    monkeypatch.setattr(dataforseo.requests, "post", lambda *a, **k: _Resp({}, 500))
    assert dataforseo.fetch_search_volumes(["x"]) == {}


def test_missing_credentials_returns_empty(monkeypatch):
    monkeypatch.setattr(dataforseo, "_credentials", lambda: ("", ""))
    assert dataforseo.fetch_search_volumes(["x"]) == {}
    assert dataforseo.fetch_difficulties(["x"]) == {}
