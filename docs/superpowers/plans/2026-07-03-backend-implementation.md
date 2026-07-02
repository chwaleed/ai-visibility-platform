# AI Visibility API (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **EXECUTION STATUS (audited 2026-07-03):** Tasks 0–10 complete and reviewed (41/41 tests green); authoritative record in `.superpowers/sdd/progress.md`. Remaining: Tasks 11–15. Deviations from this plan as written:
> 1. **Provider swap (Task 6b, commit `0338494`):** Task 6's DataForSEO client was later replaced by `app/agents/seranking.py::fetch_keyword_metrics()` (SE Ranking, one call for volume+difficulty, live-verified) after DataForSEO's trial proved account-gated. Task 6's text below is historical record — do not re-implement it.
> 2. **Schema counts (Task 3):** agent-output list constraints are `min_length=1` (not 10–20/3–5); counts live in the prompts.
> 3. **Brand matching (Task 8, commit `f907269`):** visibility matching happens in space-stripped lowercase text; no suffix-split heuristics.
> 4. `.env.example` was pulled forward (exists; SE Ranking block) — Task 14 Step 3 is a verify-only step.

**Goal:** Build the complete Task 1 Flask API — 3-agent AI pipeline (discovery → scoring → recommendations), SQLAlchemy persistence, dual-mode execution, DataForSEO integration — per `docs/superpowers/specs/2026-07-03-ai-visibility-platform-design.md`.

**Architecture:** Flask app-factory + 2 blueprints. All LLM calls isolated in `app/agents/llm.py` (Anthropic `messages.parse()` + Pydantic for Agents 1&3; free-text Haiku probes for Agent 2). All HTTP responses constructed by `ApiResponse`. Pipeline orchestrator survives partial failures. SQLite + Flask-Migrate.

**Tech Stack:** Python 3.12, uv, Flask 3, Flask-SQLAlchemy, Flask-Migrate, Flask-CORS, Flask-Limiter, Pydantic v2, anthropic SDK, requests, pytest.

## Global Constraints

- Package manager: **uv only** (`uv add`, `uv run`). Never pip.
- Model IDs exactly: `claude-opus-4-8` (generation), `claude-haiku-4-5` (probes). No date suffixes.
- Every endpoint response goes through `ApiResponse` — never `jsonify` in a route.
- Success bodies are **bare/spec-shaped** (no `{"success": ...}` wrapper). Errors: `{"error": {"code", "message"}}` (+optional `details`).
- Agents/pipeline never import `anthropic` — only `app/agents/llm.py` does.
- All tests pass with **no API keys set** (every external call mocked).
- Type hints on all function signatures.
- The visibility probe prompt must NEVER mention the target domain/brand (no leakage — it would bias the check).
- Working dir for all backend commands: `d:\Assment\backend` unless stated.
- Commit after every task (repo initialized in Task 0). Never push.

---

### Task 0: Repo scaffold

**Files:**
- Create: `d:\Assment\.gitignore`

**Steps:**

- [ ] **Step 1: Init git + .gitignore** (from `d:\Assment`)

```gitignore
# Python
__pycache__/
*.pyc
.venv/
*.db
instance/
.pytest_cache/
.env

# Node
node_modules/
dist/
*.local

# OS/IDE
.DS_Store
Thumbs.db
```

Run: `git init && git add .gitignore CLAUDE.md docs/ && git commit -m "chore: project docs, spec, and conventions"`
Expected: initial commit created.

---

### Task 1: Backend skeleton — factory, config, extensions, ApiResponse, error handlers

**Files:**
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/extensions.py`, `backend/app/utils/__init__.py`, `backend/app/utils/responses.py`, `backend/app/api/__init__.py`, `backend/app/agents/__init__.py`, `backend/app/models/__init__.py`, `backend/app/schemas/__init__.py`, `backend/app/services/__init__.py`
- Test: `backend/tests/conftest.py`, `backend/tests/test_app.py`

**Interfaces:**
- Produces: `create_app(config_overrides: dict | None = None) -> Flask` · `ApiResponse.ok(data, status=200)` / `.created(data)` / `.paginated(items, page, per_page, total)` / `.error(code, message, status, details=None)` — all return `(Response, int)`.

- [ ] **Step 1: Project init**

Run from `d:\Assment`: `mkdir backend && cd backend && uv init --bare --python 3.12`
Then: `uv add flask flask-sqlalchemy flask-migrate flask-cors flask-limiter python-dotenv pydantic anthropic requests && uv add --dev pytest`

- [ ] **Step 2: Write failing tests**

`backend/tests/conftest.py`:
```python
import pytest
from sqlalchemy.pool import StaticPool

from app import create_app
from app.extensions import db


@pytest.fixture()
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            # StaticPool + check_same_thread=False: the async-run test spawns a
            # thread; a naive :memory: DB is per-connection and the thread would
            # see no tables.
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "poolclass": StaticPool,
                "connect_args": {"check_same_thread": False},
            },
            "RATELIMIT_ENABLED": False,
        }
    )
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()


@pytest.fixture()
def client(app):
    return app.test_client()
```

`backend/tests/test_app.py`:
```python
def test_factory_creates_app(app):
    assert app.testing


def test_unknown_route_returns_error_envelope(client):
    res = client.get("/api/v1/nope")
    assert res.status_code == 404
    body = res.get_json()
    assert body["error"]["code"] == "not_found"
    assert "message" in body["error"]
```

- [ ] **Step 3: Run to verify failure**

Run: `uv run pytest -q`
Expected: FAIL/error — `ModuleNotFoundError: No module named 'app'`.

- [ ] **Step 4: Implement**

`backend/app/config.py`:
```python
import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///dev.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    )
    RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "true").lower() == "true"
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    DATAFORSEO_LOGIN = os.environ.get("DATAFORSEO_LOGIN", "")
    DATAFORSEO_PASSWORD = os.environ.get("DATAFORSEO_PASSWORD", "")
```

`backend/app/extensions.py`:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
```

`backend/app/utils/responses.py`:
```python
"""Single construction point for every HTTP response in the app."""
from typing import Any

from flask import Response, jsonify


class ApiResponse:
    @staticmethod
    def ok(data: Any, status: int = 200) -> tuple[Response, int]:
        return jsonify(data), status

    @staticmethod
    def created(data: Any) -> tuple[Response, int]:
        return ApiResponse.ok(data, 201)

    @staticmethod
    def paginated(
        items: list[Any], page: int, per_page: int, total: int
    ) -> tuple[Response, int]:
        return (
            jsonify(
                {
                    "items": items,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "total_pages": max(1, -(-total // per_page)),
                    },
                }
            ),
            200,
        )

    @staticmethod
    def error(
        code: str, message: str, status: int, details: Any = None
    ) -> tuple[Response, int]:
        body: dict[str, Any] = {"error": {"code": code, "message": message}}
        if details is not None:
            body["error"]["details"] = details
        return jsonify(body), status
```

`backend/app/__init__.py`:
```python
import logging

from flask import Flask
from flask_cors import CORS
from pydantic import ValidationError

from app.config import Config
from app.extensions import db, limiter, migrate
from app.utils.responses import ApiResponse


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, origins=[o.strip() for o in app.config["CORS_ORIGINS"].split(",")])

    if not app.testing:
        logging.basicConfig(
            level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
        )

    from app import models  # noqa: F401  (register models for migrations)
    from app.api.profiles import profiles_bp
    from app.api.queries import queries_bp

    app.register_blueprint(profiles_bp, url_prefix="/api/v1")
    app.register_blueprint(queries_bp, url_prefix="/api/v1")

    _register_error_handlers(app)
    return app


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(_e):
        return ApiResponse.error("not_found", "Resource not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return ApiResponse.error("method_not_allowed", "Method not allowed", 405)

    @app.errorhandler(429)
    def rate_limited(e):
        return ApiResponse.error("rate_limited", f"Rate limit exceeded: {e.description}", 429)

    @app.errorhandler(ValidationError)
    def validation_error(e: ValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"]), "message": err["msg"]}
            for err in e.errors()
        ]
        return ApiResponse.error("validation_error", "Invalid request body", 400, details)

    @app.errorhandler(500)
    def server_error(_e):
        return ApiResponse.error("internal_error", "An unexpected error occurred", 500)
```

Create empty package markers: `app/api/__init__.py`, `app/agents/__init__.py`, `app/models/__init__.py`, `app/schemas/__init__.py`, `app/services/__init__.py`, `app/utils/__init__.py` (empty files). Temporarily create stub blueprints so the import works:

`backend/app/api/profiles.py`:
```python
from flask import Blueprint

profiles_bp = Blueprint("profiles", __name__)
```

`backend/app/api/queries.py`:
```python
from flask import Blueprint

queries_bp = Blueprint("queries", __name__)
```

- [ ] **Step 5: Run tests**

Run: `uv run pytest -q`
Expected: 2 passed.

- [ ] **Step 6: Commit**

`git add backend && git commit -m "feat(backend): app factory, config, ApiResponse, error envelope"`

---

### Task 2: Data models + migrations

**Files:**
- Create: `backend/app/models/profile.py`, `backend/app/models/run.py`, `backend/app/models/query.py`, `backend/app/models/recommendation.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: `BusinessProfile(uuid, name, domain, industry, description, competitors, status, created_at, updated_at)` · `PipelineRun(uuid, profile_uuid, status, queries_discovered, queries_scored, tokens_used, error_message, started_at, completed_at)` · `DiscoveredQuery(uuid, profile_uuid, run_uuid, query_text, keyword, intent, estimated_search_volume, competitive_difficulty, opportunity_score, domain_visible, visibility_position, discovered_at)` with derived `.status` property → `"visible"|"not_visible"|"unknown"` · `ContentRecommendation(uuid, profile_uuid, query_uuid, run_uuid, content_type, title, rationale, target_keywords, priority, created_at)`. All have `.to_dict() -> dict`.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_models.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_models.py -q` — Expected: ImportError.

- [ ] **Step 3: Implement models**

`backend/app/models/profile.py`:
```python
from datetime import datetime, timezone
from uuid import uuid4

from app.extensions import db


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=None).isoformat(timespec="seconds") + "Z"


class BusinessProfile(db.Model):
    __tablename__ = "business_profiles"

    uuid = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(255), nullable=False)
    domain = db.Column(db.String(255), nullable=False)
    industry = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    competitors = db.Column(db.JSON, nullable=False, default=list)
    status = db.Column(db.String(32), nullable=False, default="created")
    created_at = db.Column(db.DateTime, nullable=False, default=_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=_now, onupdate=_now)

    runs = db.relationship("PipelineRun", backref="profile", lazy=True,
                           order_by="desc(PipelineRun.started_at)")
    queries = db.relationship("DiscoveredQuery", backref="profile", lazy=True)
    recommendations = db.relationship("ContentRecommendation", backref="profile", lazy=True)

    def to_dict(self) -> dict:
        return {
            "profile_uuid": self.uuid,
            "name": self.name,
            "domain": self.domain,
            "industry": self.industry,
            "description": self.description,
            "competitors": self.competitors,
            "status": self.status,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }
```

`backend/app/models/run.py`:
```python
from app.extensions import db
from app.models.profile import _now, _uuid, iso


class PipelineRun(db.Model):
    __tablename__ = "pipeline_runs"

    uuid = db.Column(db.String(36), primary_key=True, default=_uuid)
    profile_uuid = db.Column(db.String(36), db.ForeignKey("business_profiles.uuid"),
                             nullable=False, index=True)
    status = db.Column(db.String(32), nullable=False, default="running")
    queries_discovered = db.Column(db.Integer, nullable=False, default=0)
    queries_scored = db.Column(db.Integer, nullable=False, default=0)
    tokens_used = db.Column(db.Integer, nullable=False, default=0)
    error_message = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, nullable=False, default=_now)
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "run_uuid": self.uuid,
            "profile_uuid": self.profile_uuid,
            "status": self.status,
            "queries_discovered": self.queries_discovered,
            "queries_scored": self.queries_scored,
            "tokens_used": self.tokens_used,
            "error_message": self.error_message,
            "started_at": iso(self.started_at),
            "completed_at": iso(self.completed_at),
        }
```

`backend/app/models/query.py`:
```python
from app.extensions import db
from app.models.profile import _now, _uuid, iso


class DiscoveredQuery(db.Model):
    __tablename__ = "discovered_queries"

    uuid = db.Column(db.String(36), primary_key=True, default=_uuid)
    profile_uuid = db.Column(db.String(36), db.ForeignKey("business_profiles.uuid"),
                             nullable=False, index=True)
    run_uuid = db.Column(db.String(36), db.ForeignKey("pipeline_runs.uuid"),
                         nullable=False, index=True)
    query_text = db.Column(db.Text, nullable=False)
    keyword = db.Column(db.String(255), nullable=False)
    intent = db.Column(db.String(32), nullable=False, default="informational")
    estimated_search_volume = db.Column(db.Integer, nullable=False, default=0)
    competitive_difficulty = db.Column(db.Integer, nullable=False, default=50)
    opportunity_score = db.Column(db.Float, nullable=False, default=0.0)
    domain_visible = db.Column(db.Boolean, nullable=True)  # NULL = unknown
    visibility_position = db.Column(db.Integer, nullable=True)
    discovered_at = db.Column(db.DateTime, nullable=False, default=_now)

    @property
    def status(self) -> str:
        if self.domain_visible is None:
            return "unknown"
        return "visible" if self.domain_visible else "not_visible"

    def to_dict(self) -> dict:
        return {
            "query_uuid": self.uuid,
            "profile_uuid": self.profile_uuid,
            "run_uuid": self.run_uuid,
            "query_text": self.query_text,
            "keyword": self.keyword,
            "intent": self.intent,
            "estimated_search_volume": self.estimated_search_volume,
            "competitive_difficulty": self.competitive_difficulty,
            "opportunity_score": self.opportunity_score,
            "domain_visible": self.domain_visible,
            "visibility_position": self.visibility_position,
            "status": self.status,
            "discovered_at": iso(self.discovered_at),
        }
```

`backend/app/models/recommendation.py`:
```python
from app.extensions import db
from app.models.profile import _now, _uuid, iso


class ContentRecommendation(db.Model):
    __tablename__ = "content_recommendations"

    uuid = db.Column(db.String(36), primary_key=True, default=_uuid)
    profile_uuid = db.Column(db.String(36), db.ForeignKey("business_profiles.uuid"),
                             nullable=False, index=True)
    query_uuid = db.Column(db.String(36), db.ForeignKey("discovered_queries.uuid"),
                           nullable=False)
    run_uuid = db.Column(db.String(36), db.ForeignKey("pipeline_runs.uuid"),
                         nullable=False, index=True)
    content_type = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(500), nullable=False)
    rationale = db.Column(db.Text, nullable=False)
    target_keywords = db.Column(db.JSON, nullable=False, default=list)
    priority = db.Column(db.String(16), nullable=False, default="medium")
    created_at = db.Column(db.DateTime, nullable=False, default=_now)

    def to_dict(self) -> dict:
        return {
            "recommendation_uuid": self.uuid,
            "target_query_uuid": self.query_uuid,
            "run_uuid": self.run_uuid,
            "content_type": self.content_type,
            "title": self.title,
            "rationale": self.rationale,
            "target_keywords": self.target_keywords,
            "priority": self.priority,
            "created_at": iso(self.created_at),
        }
```

`backend/app/models/__init__.py`:
```python
from app.models.profile import BusinessProfile
from app.models.query import DiscoveredQuery
from app.models.recommendation import ContentRecommendation
from app.models.run import PipelineRun

__all__ = ["BusinessProfile", "DiscoveredQuery", "ContentRecommendation", "PipelineRun"]
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.

- [ ] **Step 5: Generate initial migration**

Run: `uv run flask --app app db init` then `uv run flask --app app db migrate -m "initial schema"` then `uv run flask --app app db upgrade`
Expected: `backend/migrations/` created with one revision; `instance/dev.db` created.

- [ ] **Step 6: Commit**

`git add backend && git commit -m "feat(backend): SQLAlchemy models + initial migration"`

---

### Task 3: Pydantic schemas (request + agent outputs)

**Files:**
- Create: `backend/app/schemas/requests.py`, `backend/app/schemas/agent_outputs.py`
- Test: `backend/tests/test_schemas.py`

**Interfaces:**
- Produces: `ProfileCreate(name, domain, industry, description="", competitors=[])` · `DiscoveredQueryItem(question, keyword, intent)` · `DiscoveryOutput(queries: list[DiscoveredQueryItem])` · `RecommendationItem(target_query_uuid, content_type, title, rationale, target_keywords, priority)` · `RecommendationOutput(recommendations: list[RecommendationItem])`.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_schemas.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure** — `uv run pytest tests/test_schemas.py -q` — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/schemas/requests.py`:
```python
from pydantic import BaseModel, Field, field_validator


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    domain: str = Field(min_length=3, max_length=255)
    industry: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    competitors: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, v: str) -> str:
        v = v.strip().lower().removeprefix("https://").removeprefix("http://")
        v = v.removeprefix("www.").rstrip("/")
        if "." not in v:
            raise ValueError("domain must look like 'example.com'")
        return v

    @field_validator("competitors")
    @classmethod
    def normalize_competitors(cls, v: list[str]) -> list[str]:
        return [c.strip().lower().removeprefix("https://").removeprefix("http://")
                .removeprefix("www.").rstrip("/") for c in v if c.strip()]
```

`backend/app/schemas/agent_outputs.py`:
```python
"""Schemas the LLM must produce. Also spelled out inside the agent prompts —
the parse() call enforces them at the API layer; the prompt makes the
contract explicit to the model (and to assessment reviewers)."""
from typing import Literal

from pydantic import BaseModel, Field

Intent = Literal["transactional", "commercial", "informational"]
ContentType = Literal["blog_post", "landing_page", "faq", "comparison_page", "guide"]
Priority = Literal["high", "medium", "low"]


class DiscoveredQueryItem(BaseModel):
    question: str = Field(description="Natural-language question a user would ask an AI assistant")
    keyword: str = Field(description="2-4 word search phrase capturing the question's core topic")
    intent: Intent


class DiscoveryOutput(BaseModel):
    queries: list[DiscoveredQueryItem] = Field(min_length=10, max_length=20)


class RecommendationItem(BaseModel):
    target_query_uuid: str
    content_type: ContentType
    title: str
    rationale: str
    target_keywords: list[str] = Field(min_length=1, max_length=8)
    priority: Priority


class RecommendationOutput(BaseModel):
    recommendations: list[RecommendationItem] = Field(min_length=3, max_length=5)
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): Pydantic request + agent output schemas"`

---

### Task 4: Opportunity score (pure function)

**Files:**
- Create: `backend/app/utils/scoring.py`
- Test: `backend/tests/test_scoring.py`

**Interfaces:**
- Produces: `compute_opportunity_score(volume: int, difficulty: int, visible: bool | None, position: int | None, intent: str) -> float` (0.0–1.0, rounded 4dp).

- [ ] **Step 1: Write failing tests**

`backend/tests/test_scoring.py`:
```python
from app.utils.scoring import compute_opportunity_score as score


def test_bounds():
    assert 0.0 <= score(0, 100, True, 1, "informational") <= 1.0
    assert 0.0 <= score(10**7, 0, False, None, "transactional") <= 1.0


def test_more_volume_scores_higher():
    assert score(10000, 50, False, None, "commercial") > score(100, 50, False, None, "commercial")


def test_lower_difficulty_scores_higher():
    assert score(1000, 20, False, None, "commercial") > score(1000, 80, False, None, "commercial")


def test_gap_ordering_not_visible_beats_visible():
    not_visible = score(1000, 50, False, None, "commercial")
    unknown = score(1000, 50, None, None, "commercial")
    visible_late = score(1000, 50, True, 3, "commercial")
    visible_first = score(1000, 50, True, 1, "commercial")
    assert not_visible > unknown > visible_late > visible_first


def test_intent_ordering():
    t = score(1000, 50, False, None, "transactional")
    c = score(1000, 50, False, None, "commercial")
    i = score(1000, 50, False, None, "informational")
    assert t > c > i


def test_max_realistic_case_near_one():
    assert score(500_000, 5, False, None, "transactional") > 0.9
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/utils/scoring.py`:
```python
"""Opportunity score: how valuable it is for the target domain to appear in
the AI answer for a query.

    score = 0.35*volume_n + 0.25*ease + 0.25*gap + 0.15*intent_w

- volume_n: log10-scaled demand, saturating at 100k searches/month.
- ease:     inverse of competitive difficulty.
- gap:      1.0 absent, 0.7 unknown, 0.4 mentioned-but-not-first, 0.0 first mention.
- intent_w: buyer proximity (transactional > commercial > informational).

Full rationale documented in backend/README.md (assessment requirement).
"""
from math import log10

_WEIGHTS = {"volume": 0.35, "ease": 0.25, "gap": 0.25, "intent": 0.15}
_INTENT = {"transactional": 1.0, "commercial": 0.7, "informational": 0.3}


def _gap(visible: bool | None, position: int | None) -> float:
    if visible is None:
        return 0.7
    if not visible:
        return 1.0
    return 0.0 if position == 1 else 0.4


def compute_opportunity_score(
    volume: int, difficulty: int, visible: bool | None,
    position: int | None, intent: str,
) -> float:
    volume_n = min(1.0, log10(max(volume, 0) + 1) / 5)
    ease = 1.0 - min(max(difficulty, 0), 100) / 100
    raw = (
        _WEIGHTS["volume"] * volume_n
        + _WEIGHTS["ease"] * ease
        + _WEIGHTS["gap"] * _gap(visible, position)
        + _WEIGHTS["intent"] * _INTENT.get(intent, 0.3)
    )
    return round(raw, 4)
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -am "feat(backend): multi-factor opportunity score"`

---

### Task 5: LLM gateway (`llm.py`)

**Files:**
- Create: `backend/app/agents/llm.py`
- Test: `backend/tests/test_llm.py`

**Interfaces:**
- Produces: `GENERATION_MODEL = "claude-opus-4-8"` · `PROBE_MODEL = "claude-haiku-4-5"` · `Usage(input_tokens, output_tokens)` dataclass with `total` property · `AgentError(Exception)` · `generate_structured(system: str, user: str, schema: type[T], model: str = GENERATION_MODEL, max_tokens: int = 4096) -> tuple[T, Usage]` (one retry, then `AgentError`) · `generate_text(system: str, user: str, model: str = PROBE_MODEL, max_tokens: int = 700) -> tuple[str, Usage]` · `get_client()` (patch point for tests).

- [ ] **Step 1: Write failing tests**

`backend/tests/test_llm.py`:
```python
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

from app.agents import llm
from app.agents.llm import AgentError, generate_structured, generate_text


class Demo(BaseModel):
    answer: str


def _parse_response(obj):
    return SimpleNamespace(
        parsed_output=obj,
        usage=SimpleNamespace(input_tokens=10, output_tokens=20),
    )


def test_generate_structured_success(monkeypatch):
    client = MagicMock()
    client.messages.parse.return_value = _parse_response(Demo(answer="hi"))
    monkeypatch.setattr(llm, "get_client", lambda: client)

    result, usage = generate_structured("sys", "user", Demo)
    assert result.answer == "hi"
    assert usage.input_tokens == 10 and usage.output_tokens == 20


def test_generate_structured_retries_once_then_succeeds(monkeypatch):
    client = MagicMock()
    client.messages.parse.side_effect = [
        RuntimeError("malformed"),
        _parse_response(Demo(answer="second try")),
    ]
    monkeypatch.setattr(llm, "get_client", lambda: client)

    result, _ = generate_structured("sys", "user", Demo)
    assert result.answer == "second try"
    assert client.messages.parse.call_count == 2


def test_generate_structured_raises_agent_error_after_retries(monkeypatch):
    client = MagicMock()
    client.messages.parse.side_effect = RuntimeError("still malformed")
    monkeypatch.setattr(llm, "get_client", lambda: client)

    with pytest.raises(AgentError):
        generate_structured("sys", "user", Demo)
    assert client.messages.parse.call_count == 2


def test_generate_text_joins_text_blocks(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(type="text", text="Try Surfer SEO"),
            SimpleNamespace(type="text", text=" or Clearscope."),
        ],
        usage=SimpleNamespace(input_tokens=5, output_tokens=9),
    )
    monkeypatch.setattr(llm, "get_client", lambda: client)

    text, usage = generate_text("sys", "what tool?")
    assert text == "Try Surfer SEO or Clearscope."
    assert usage.total == 14
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/agents/llm.py`:
```python
"""The ONLY module that talks to the Anthropic SDK.

Swapping LLM providers later means reimplementing this file's two public
functions — nothing else in the app imports `anthropic` (deliberate; see
README "Provider portability").
"""
import logging
import os
from dataclasses import dataclass
from typing import TypeVar

from anthropic import Anthropic
from pydantic import BaseModel

logger = logging.getLogger("agents.llm")

GENERATION_MODEL = "claude-opus-4-8"   # Agents 1 & 3: quality generation
PROBE_MODEL = "claude-haiku-4-5"       # Agent 2: fast/cheap visibility probes

T = TypeVar("T", bound=BaseModel)

_client: Anthropic | None = None


class AgentError(Exception):
    """An agent call failed after retries; callers decide how to degrade."""


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


def _usage_of(response) -> Usage:
    u = getattr(response, "usage", None)
    return Usage(getattr(u, "input_tokens", 0) or 0, getattr(u, "output_tokens", 0) or 0)


def generate_structured(
    system: str, user: str, schema: type[T],
    model: str = GENERATION_MODEL, max_tokens: int = 4096,
) -> tuple[T, Usage]:
    """Schema-enforced call via messages.parse(). One retry, then AgentError.

    The schema is ALSO spelled out inside the system prompt — parse() makes
    malformed JSON nearly impossible; the prompt keeps the contract explicit.
    """
    last_error: Exception | None = None
    for attempt in (1, 2):
        try:
            response = get_client().messages.parse(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_format=schema,
            )
            if response.parsed_output is None:
                raise ValueError("model returned no parseable output")
            return response.parsed_output, _usage_of(response)
        except Exception as e:  # noqa: BLE001 — any SDK/validation failure → retry once
            last_error = e
            logger.warning("structured call failed (attempt %s/2): %s", attempt, e)
    raise AgentError(f"LLM structured call failed after 2 attempts: {last_error}")


def generate_text(
    system: str, user: str, model: str = PROBE_MODEL, max_tokens: int = 700,
) -> tuple[str, Usage]:
    """Free-text call (visibility probes — we WANT a natural answer, not JSON)."""
    response = get_client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    return text, _usage_of(response)
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): centralized LLM gateway with retry + AgentError"`

---

### Task 6: DataForSEO client

**Files:**
- Create: `backend/app/agents/dataforseo.py`
- Test: `backend/tests/test_dataforseo.py`

**Interfaces:**
- Produces: `fetch_search_volumes(keywords: list[str]) -> dict[str, int]` · `fetch_difficulties(keywords: list[str]) -> dict[str, int]`. Both return `{}` on ANY failure (missing creds, HTTP error, bad payload) — scoring falls back to defaults and the run continues.
- Endpoints (verified from docs.dataforseo.com, 2026-07): `POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live` and `POST https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live`. HTTP Basic auth (login/password). Body: `[{"keywords": [...], "location_code": 2840, "language_code": "en"}]`.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_dataforseo.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/agents/dataforseo.py`:
```python
"""Real search data (assessment requirement: no invented numbers).

Every function degrades to {} on failure — the pipeline then scores with
neutral defaults instead of crashing (partial-failure requirement).
"""
import logging
import os

import requests

logger = logging.getLogger("agents.dataforseo")

BASE = "https://api.dataforseo.com/v3"
VOLUME_URL = f"{BASE}/keywords_data/google_ads/search_volume/live"
DIFFICULTY_URL = f"{BASE}/dataforseo_labs/google/bulk_keyword_difficulty/live"
TIMEOUT = 30
LOCATION_US = 2840


def _credentials() -> tuple[str, str]:
    return os.environ.get("DATAFORSEO_LOGIN", ""), os.environ.get("DATAFORSEO_PASSWORD", "")


def _post(url: str, keywords: list[str]) -> dict | None:
    login, password = _credentials()
    if not login or not password:
        logger.warning("DataForSEO credentials missing — skipping real-data call")
        return None
    payload = [{"keywords": keywords, "location_code": LOCATION_US, "language_code": "en"}]
    try:
        res = requests.post(url, auth=(login, password), json=payload, timeout=TIMEOUT)
        res.raise_for_status()
        data = res.json()
        task = data["tasks"][0]
        if task.get("status_code") != 20000:
            logger.warning("DataForSEO task error: %s", task.get("status_message"))
            return None
        return task
    except Exception as e:  # noqa: BLE001 — any failure degrades gracefully
        logger.warning("DataForSEO call failed: %s", e)
        return None


def fetch_search_volumes(keywords: list[str]) -> dict[str, int]:
    task = _post(VOLUME_URL, keywords)
    if not task:
        return {}
    out: dict[str, int] = {}
    for item in task.get("result") or []:
        if item and item.get("keyword"):
            out[item["keyword"]] = int(item.get("search_volume") or 0)
    return out


def fetch_difficulties(keywords: list[str]) -> dict[str, int]:
    task = _post(DIFFICULTY_URL, keywords)
    if not task:
        return {}
    out: dict[str, int] = {}
    for block in task.get("result") or []:
        for item in (block or {}).get("items") or []:
            if item and item.get("keyword") is not None:
                out[item["keyword"]] = int(item.get("keyword_difficulty") or 50)
    return out
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): DataForSEO client with graceful degradation"`

---

### Task 7: Agent 1 — Query Discovery

**Files:**
- Create: `backend/app/agents/discovery.py`
- Test: `backend/tests/test_discovery.py`

**Interfaces:**
- Consumes: `generate_structured`, `DiscoveryOutput`, `Usage` from earlier tasks; `BusinessProfile` model.
- Produces: `QueryDiscoveryAgent().discover(profile: BusinessProfile) -> tuple[list[DiscoveredQueryItem], Usage]`.

- [ ] **Step 1: Write failing test**

`backend/tests/test_discovery.py`:
```python
from app.agents import discovery
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.llm import Usage
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem, DiscoveryOutput


def test_discover_returns_items_and_usage(app, monkeypatch):
    fake = DiscoveryOutput(queries=[
        DiscoveredQueryItem(question=f"Question {i}?", keyword=f"kw {i}",
                            intent="commercial")
        for i in range(12)
    ])
    captured: dict = {}

    def fake_generate(system, user, schema, **kw):
        captured["system"], captured["user"] = system, user
        return fake, Usage(100, 400)

    monkeypatch.setattr(discovery, "generate_structured", fake_generate)

    profile = BusinessProfile(
        name="Frase", domain="frase.io", industry="SEO Content Tools",
        description="AI briefs", competitors=["surferseo.com"],
    )
    items, usage = QueryDiscoveryAgent().discover(profile)

    assert len(items) == 12
    assert usage.total == 500
    # profile data must be substituted into the user prompt
    assert "frase.io" in captured["user"] and "surferseo.com" in captured["user"]
    # system prompt must define the output contract
    assert "JSON" in captured["system"] and "keyword" in captured["system"]
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/agents/discovery.py`:
```python
"""Agent 1 — Query Discovery.

Given a business profile, generates 12–18 realistic questions users ask AI
assistants in that competitive space, each with a priceable seed keyword and
an intent label (both feed Agent 2 and the opportunity score).
"""
from app.agents.llm import Usage, generate_structured
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem, DiscoveryOutput

SYSTEM_PROMPT = """You are a senior Answer Engine Optimization (AEO) strategist. \
Businesses hire you to find out which questions their potential customers ask AI \
assistants (ChatGPT, Claude, Perplexity) so they can win visibility in AI answers.

Given a business profile, generate 12-18 realistic, commercially relevant questions.

Requirements for the question set:
- Natural language, phrased exactly as a real user would type to a chatbot.
- Mix of intents: roughly 40% transactional (best-of lists, "X vs Y" comparisons, \
pricing/alternatives), 40% commercial (how to choose, "is X worth it", tool-for-job), \
20% informational (concept/how-to questions adjacent to the product).
- At least 2 direct comparison questions that name the business and/or its competitors.
- Vary length and phrasing. No near-duplicates. No questions about the business's \
internal affairs (careers, support, login).

For EACH question also produce:
- "keyword": the 2-4 word search phrase a person would type into Google for the same \
need (used to look up real search volume — must be a plausible search term, not a \
sentence).
- "intent": one of "transactional", "commercial", "informational". Classify \
comparison/vs/best-of/pricing questions as "transactional".

Return ONLY valid JSON matching exactly this schema:
{"queries": [{"question": "<string>", "keyword": "<string>", "intent": "transactional|commercial|informational"}, ...]}
No prose, no markdown fences, no extra keys."""

USER_TEMPLATE = """Business profile:
- Name: {name}
- Domain: {domain}
- Industry: {industry}
- Description: {description}
- Competitors: {competitors}

Generate the question set for this business's competitive space."""


class QueryDiscoveryAgent:
    def discover(self, profile: BusinessProfile) -> tuple[list[DiscoveredQueryItem], Usage]:
        user = USER_TEMPLATE.format(
            name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            description=profile.description or "(none provided)",
            competitors=", ".join(profile.competitors) or "(none listed)",
        )
        output, usage = generate_structured(SYSTEM_PROMPT, user, DiscoveryOutput)
        return output.queries, usage
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): Agent 1 query discovery"`

---

### Task 8: Agent 2 — Visibility Scoring

**Files:**
- Create: `backend/app/agents/scoring.py`
- Test: `backend/tests/test_scoring_agent.py`

**Interfaces:**
- Consumes: `generate_text`, `Usage`, `fetch_search_volumes`, `fetch_difficulties`, `compute_opportunity_score`, `DiscoveredQueryItem`.
- Produces: `VisibilityScoringAgent().score_all(profile, items: list[DiscoveredQueryItem]) -> tuple[list[ScoredQuery], Usage]` where `ScoredQuery` is a dataclass `(question, keyword, intent, volume, difficulty, visible: bool|None, position: int|None, opportunity_score: float)` · `VisibilityScoringAgent().score_single(profile, question, keyword, intent) -> ScoredQuery` (used by recheck) · pure helper `extract_visibility(answer: str, target_variants: list[str], competitor_variants: list[list[str]]) -> tuple[bool, int | None]` · `brand_variants(domain: str, name: str | None = None) -> list[str]`.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_scoring_agent.py`:
```python
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


def _profile() -> BusinessProfile:
    return BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                           description="", competitors=["surferseo.com"])


def _items(n=3):
    return [DiscoveredQueryItem(question=f"Q{i}?", keyword=f"kw{i}",
                                intent="commercial") for i in range(n)]


def test_score_all_happy_path(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_search_volumes",
                        lambda kws: {k: 1000 for k in kws})
    monkeypatch.setattr(scoring, "fetch_difficulties",
                        lambda kws: {k: 40 for k in kws})
    monkeypatch.setattr(scoring, "generate_text",
                        lambda system, user, **kw: ("Frase is great.", Usage(10, 20)))

    scored, usage = VisibilityScoringAgent().score_all(_profile(), _items(3))
    assert len(scored) == 3
    assert all(s.visible is True for s in scored)
    assert all(0.0 <= s.opportunity_score <= 1.0 for s in scored)
    assert usage.total == 90  # 3 probes x 30


def test_score_all_probe_failure_marks_unknown_and_continues(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_search_volumes", lambda kws: {})
    monkeypatch.setattr(scoring, "fetch_difficulties", lambda kws: {})
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
    # DataForSEO empty → neutral defaults applied
    assert ok.volume == 0 and ok.difficulty == 50


def test_probe_prompt_never_leaks_target(app, monkeypatch):
    monkeypatch.setattr(scoring, "fetch_search_volumes", lambda kws: {})
    monkeypatch.setattr(scoring, "fetch_difficulties", lambda kws: {})
    seen = []

    def spy(system, user, **kw):
        seen.append((system, user))
        return "answer", Usage(1, 1)

    monkeypatch.setattr(scoring, "generate_text", spy)
    VisibilityScoringAgent().score_all(_profile(), _items(1))
    for system, user in seen:
        assert "frase" not in system.lower()      # no bias leakage
        assert "frase" not in user.lower()
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/agents/scoring.py`:
```python
"""Agent 2 — Visibility Scoring.

For each discovered query:
1. Real search volume + difficulty (DataForSEO, batched once per run).
2. Visibility probe: Haiku answers the question NATURALLY (the prompt never
   mentions the target business — mentioning it would bias the simulation),
   then deterministic string-matching detects which brands appear and in
   what order.
3. Multi-factor opportunity score.

Per-query failures mark that query unknown and never abort the run.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from app.agents.dataforseo import fetch_difficulties, fetch_search_volumes
from app.agents.llm import PROBE_MODEL, Usage, generate_text
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem
from app.utils.scoring import compute_opportunity_score

logger = logging.getLogger("agents.scoring")

MAX_PROBE_WORKERS = 5
DEFAULT_VOLUME = 0
DEFAULT_DIFFICULTY = 50

PROBE_SYSTEM = """You are a knowledgeable assistant helping a user choose products \
and services. Answer the user's question directly and naturally, exactly as you \
would in a normal chat. Recommend and NAME specific tools, companies, or products \
where relevant. Be concise: under 150 words."""


@dataclass
class ScoredQuery:
    question: str
    keyword: str
    intent: str
    volume: int
    difficulty: int
    visible: bool | None
    position: int | None
    opportunity_score: float


def brand_variants(domain: str, name: str | None = None) -> list[str]:
    """Strings whose presence in an answer counts as a mention of this brand."""
    variants = {domain.lower()}
    root = domain.lower().split(".")[0]
    if len(root) >= 4:                      # skip too-generic short roots
        variants.add(root)
    if name:
        variants.add(name.lower())
    return sorted(variants)


def _first_index(answer_lower: str, variants: list[str]) -> int | None:
    hits = [answer_lower.find(v) for v in variants if v in answer_lower]
    return min(hits) if hits else None


def extract_visibility(
    answer: str, target_variants: list[str], competitor_variants: list[list[str]],
) -> tuple[bool, int | None]:
    """(visible, position) — position is the target's 1-based rank among all
    brands mentioned, ordered by first occurrence in the answer."""
    answer_lower = answer.lower()
    target_idx = _first_index(answer_lower, target_variants)
    if target_idx is None:
        return False, None
    competitor_idxs = [
        idx for cv in competitor_variants
        if (idx := _first_index(answer_lower, cv)) is not None
    ]
    position = 1 + sum(1 for idx in competitor_idxs if idx < target_idx)
    return True, position


class VisibilityScoringAgent:
    def score_all(
        self, profile: BusinessProfile, items: list[DiscoveredQueryItem],
    ) -> tuple[list[ScoredQuery], Usage]:
        keywords = [i.keyword for i in items]
        volumes = fetch_search_volumes(keywords)
        difficulties = fetch_difficulties(keywords)

        total = Usage()
        target = brand_variants(profile.domain, profile.name)
        competitors = [brand_variants(c) for c in profile.competitors]

        def probe(item: DiscoveredQueryItem) -> tuple[ScoredQuery, Usage]:
            visible: bool | None
            position: int | None
            probe_usage = Usage()
            try:
                answer, probe_usage = generate_text(PROBE_SYSTEM, item.question,
                                                    model=PROBE_MODEL)
                visible, position = extract_visibility(answer, target, competitors)
            except Exception as e:  # noqa: BLE001 — isolate per-query failures
                logger.warning("visibility probe failed for %r: %s", item.question, e)
                visible, position = None, None

            volume = volumes.get(item.keyword, DEFAULT_VOLUME)
            difficulty = difficulties.get(item.keyword, DEFAULT_DIFFICULTY)
            return ScoredQuery(
                question=item.question, keyword=item.keyword, intent=item.intent,
                volume=volume, difficulty=difficulty,
                visible=visible, position=position,
                opportunity_score=compute_opportunity_score(
                    volume, difficulty, visible, position, item.intent),
            ), probe_usage

        with ThreadPoolExecutor(max_workers=MAX_PROBE_WORKERS) as pool:
            results = list(pool.map(probe, items))
        scored = [r for r, _ in results]
        # Usage is summed here in the main thread — `+=` from inside worker
        # threads would be a read-modify-write race and could drop updates.
        for _, u in results:
            total.input_tokens += u.input_tokens
            total.output_tokens += u.output_tokens
        return scored, total

    def score_single(
        self, profile: BusinessProfile, question: str, keyword: str, intent: str,
    ) -> ScoredQuery:
        item = DiscoveredQueryItem(question=question, keyword=keyword, intent=intent)
        scored, _ = self.score_all(profile, [item])
        return scored[0]
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): Agent 2 visibility scoring with parallel probes + partial failure"`

---

### Task 9: Agent 3 — Content Recommendations

**Files:**
- Create: `backend/app/agents/recommendation.py`
- Test: `backend/tests/test_recommendation_agent.py`

**Interfaces:**
- Consumes: `generate_structured`, `RecommendationOutput`, `Usage`.
- Produces: `ContentRecommendationAgent().recommend(profile, gaps: list[GapQuery]) -> tuple[list[RecommendationItem], Usage]` where `GapQuery` is a dataclass `(query_uuid, question, keyword, opportunity_score)`. Guarantees every returned `target_query_uuid` is one of the provided gap uuids (invalid → reassigned round-robin).

- [ ] **Step 1: Write failing tests**

`backend/tests/test_recommendation_agent.py`:
```python
from app.agents import recommendation
from app.agents.llm import Usage
from app.agents.recommendation import ContentRecommendationAgent, GapQuery
from app.models import BusinessProfile
from app.schemas.agent_outputs import RecommendationItem, RecommendationOutput


def _gaps():
    return [
        GapQuery(query_uuid="uuid-1", question="Best AI brief tool?",
                 keyword="ai brief tool", opportunity_score=0.9),
        GapQuery(query_uuid="uuid-2", question="Frase vs Surfer?",
                 keyword="frase vs surfer", opportunity_score=0.8),
    ]


def _recs(uuids):
    return RecommendationOutput(recommendations=[
        RecommendationItem(target_query_uuid=u, content_type="blog_post",
                           title=f"T{i}", rationale="R", target_keywords=["k"],
                           priority="high")
        for i, u in enumerate(uuids)
    ])


def test_recommend_passes_gaps_and_returns_items(app, monkeypatch):
    captured = {}

    def fake(system, user, schema, **kw):
        captured["user"] = user
        return _recs(["uuid-1", "uuid-2", "uuid-1"]), Usage(50, 100)

    monkeypatch.setattr(recommendation, "generate_structured", fake)
    profile = BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                              description="", competitors=[])
    items, usage = ContentRecommendationAgent().recommend(profile, _gaps())
    assert len(items) == 3
    assert usage.total == 150
    assert "uuid-1" in captured["user"]          # uuids provided to the model


def test_invalid_uuid_reassigned_to_valid_gap(app, monkeypatch):
    monkeypatch.setattr(
        recommendation, "generate_structured",
        lambda *a, **k: (_recs(["made-up-uuid", "uuid-2", "also-bad"]), Usage(1, 1)),
    )
    profile = BusinessProfile(name="F", domain="frase.io", industry="S",
                              description="", competitors=[])
    items, _ = ContentRecommendationAgent().recommend(profile, _gaps())
    valid = {"uuid-1", "uuid-2"}
    assert all(r.target_query_uuid in valid for r in items)
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/agents/recommendation.py`:
```python
"""Agent 3 — Content Recommendations.

Input: the top-scoring queries where the target domain is NOT visible.
Output: 3-5 concrete content pieces that close those gaps.
"""
from dataclasses import dataclass

from app.agents.llm import Usage, generate_structured
from app.models import BusinessProfile
from app.schemas.agent_outputs import RecommendationItem, RecommendationOutput

SYSTEM_PROMPT = """You are a content strategist specializing in AI-answer visibility \
(AEO/GEO). A business is NOT being mentioned when AI assistants answer high-value \
questions in its space. Your job: recommend 3-5 specific content pieces that would \
make AI assistants start citing this business for those questions.

Rules:
- Each recommendation targets exactly ONE of the provided queries; set \
"target_query_uuid" to that query's uuid VERBATIM (copy it exactly).
- "title": a concrete, publishable title (not a topic label).
- "rationale": 1-3 sentences on WHY this content closes the visibility gap for that \
specific query.
- "target_keywords": 3-6 keywords/phrases the content must cover.
- "content_type": one of "blog_post", "landing_page", "faq", "comparison_page", "guide".
- "priority": "high" for the biggest opportunity scores, "medium"/"low" accordingly.
- Prefer comparison content for vs/alternative queries; guides for how-to queries.

Return ONLY valid JSON matching exactly:
{"recommendations": [{"target_query_uuid": "<uuid>", "content_type": "...", \
"title": "...", "rationale": "...", "target_keywords": ["..."], "priority": "high|medium|low"}, ...]}
No prose, no markdown fences, no extra keys."""

USER_TEMPLATE = """Business: {name} ({domain}), industry: {industry}.

High-opportunity queries where this business is currently ABSENT from AI answers
(sorted by opportunity, highest first):
{gaps}

Produce 3-5 content recommendations."""


@dataclass
class GapQuery:
    query_uuid: str
    question: str
    keyword: str
    opportunity_score: float


class ContentRecommendationAgent:
    def recommend(
        self, profile: BusinessProfile, gaps: list[GapQuery],
    ) -> tuple[list[RecommendationItem], Usage]:
        gap_lines = "\n".join(
            f'- uuid: {g.query_uuid} | score: {g.opportunity_score} | '
            f'question: "{g.question}" | keyword: {g.keyword}'
            for g in gaps
        )
        user = USER_TEMPLATE.format(
            name=profile.name, domain=profile.domain,
            industry=profile.industry, gaps=gap_lines,
        )
        output, usage = generate_structured(SYSTEM_PROMPT, user, RecommendationOutput)

        # Guard: model must reference provided uuids; reassign any hallucinated one.
        valid = {g.query_uuid for g in gaps}
        for i, rec in enumerate(output.recommendations):
            if rec.target_query_uuid not in valid:
                rec.target_query_uuid = gaps[i % len(gaps)].query_uuid
        return output.recommendations, usage
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): Agent 3 content recommendations with uuid guard"`

---

### Task 10: Pipeline orchestrator

**Files:**
- Create: `backend/app/services/pipeline.py`
- Test: `backend/tests/test_pipeline.py`

**Interfaces:**
- Consumes: all three agents, models, `AgentError`.
- Produces: `execute_pipeline(profile_uuid: str, run_uuid: str) -> None` (runs inside an app context; commits everything; never raises — failures land on the run row) · `build_run_payload(run: PipelineRun) -> dict` (the spec-exact response: run_uuid, status, counts, tokens_used, timestamps, error_message, `top_queries` (top 3 by score), `recommendations`) · `start_run(profile_uuid: str) -> PipelineRun` (creates the run row in status "running").

- [ ] **Step 1: Write failing tests**

`backend/tests/test_pipeline.py`:
```python
from app.agents.llm import AgentError, Usage
from app.agents.scoring import ScoredQuery
from app.extensions import db
from app.models import BusinessProfile, ContentRecommendation, DiscoveredQuery
from app.schemas.agent_outputs import (
    DiscoveredQueryItem,
    RecommendationItem,
)
from app.services import pipeline
from app.services.pipeline import build_run_payload, execute_pipeline, start_run


def _profile():
    p = BusinessProfile(name="Frase", domain="frase.io", industry="SEO",
                        description="", competitors=["surferseo.com"])
    db.session.add(p)
    db.session.commit()
    return p


def _stub_agents(monkeypatch, n_queries=4, fail_recs=False):
    items = [DiscoveredQueryItem(question=f"Q{i}?", keyword=f"kw{i}",
                                 intent="commercial") for i in range(n_queries)]
    monkeypatch.setattr(pipeline.QueryDiscoveryAgent, "discover",
                        lambda self, prof: (items, Usage(100, 200)))

    def fake_score(self, prof, its):
        return [
            ScoredQuery(question=i.question, keyword=i.keyword, intent=i.intent,
                        volume=1000, difficulty=40,
                        visible=(idx % 2 == 0),            # half visible, half not
                        position=1 if idx % 2 == 0 else None,
                        opportunity_score=0.5 + idx * 0.1)
            for idx, i in enumerate(its)
        ], Usage(50, 50)

    monkeypatch.setattr(pipeline.VisibilityScoringAgent, "score_all", fake_score)

    def fake_recommend(self, prof, gaps):
        if fail_recs:
            raise AgentError("agent 3 down")
        return [
            RecommendationItem(target_query_uuid=gaps[0].query_uuid,
                               content_type="blog_post", title="T", rationale="R",
                               target_keywords=["k"], priority="high"),
            RecommendationItem(target_query_uuid=gaps[0].query_uuid,
                               content_type="faq", title="T2", rationale="R2",
                               target_keywords=["k"], priority="medium"),
            RecommendationItem(target_query_uuid=gaps[-1].query_uuid,
                               content_type="guide", title="T3", rationale="R3",
                               target_keywords=["k"], priority="low"),
        ], Usage(30, 70)

    monkeypatch.setattr(pipeline.ContentRecommendationAgent, "recommend",
                        fake_recommend)


def test_full_run_persists_everything(app, monkeypatch):
    _stub_agents(monkeypatch)
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "completed"
    assert run.queries_discovered == 4
    assert run.queries_scored == 4
    assert run.tokens_used == 100 + 200 + 50 + 50 + 30 + 70
    assert run.completed_at is not None
    assert DiscoveredQuery.query.count() == 4
    assert ContentRecommendation.query.count() == 3
    db.session.refresh(p)
    assert p.status == "analyzed"

    payload = build_run_payload(run)
    assert payload["status"] == "completed"
    assert len(payload["top_queries"]) == 3
    scores = [q["opportunity_score"] for q in payload["top_queries"]]
    assert scores == sorted(scores, reverse=True)
    assert len(payload["recommendations"]) == 3


def test_agent3_failure_still_completes_run(app, monkeypatch):
    _stub_agents(monkeypatch, fail_recs=True)
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "completed"                 # queries still valuable
    assert "recommendation" in (run.error_message or "").lower()
    assert ContentRecommendation.query.count() == 0


def test_agent1_failure_fails_run(app, monkeypatch):
    monkeypatch.setattr(pipeline.QueryDiscoveryAgent, "discover",
                        lambda self, prof: (_ for _ in ()).throw(AgentError("boom")))
    p = _profile()
    run = start_run(p.uuid)
    execute_pipeline(p.uuid, run.uuid)

    db.session.refresh(run)
    assert run.status == "failed"
    assert "boom" in run.error_message
    assert DiscoveredQuery.query.count() == 0
```

- [ ] **Step 2: Run to verify failure** — Expected: ImportError.

- [ ] **Step 3: Implement**

`backend/app/services/pipeline.py`:
```python
"""Orchestrator: Agent 1 -> Agent 2 -> Agent 3, with partial-failure handling.

Failure policy (documented in README):
- Agent 1 fails  -> run FAILED (nothing to score).
- Agent 2: per-query failures are isolated inside the agent (query -> unknown).
- Agent 3 fails  -> run still COMPLETED (queries are valuable alone); the
  failure is recorded on the run's error_message.
"""
import logging
from datetime import datetime, timezone

from app.agents.discovery import QueryDiscoveryAgent
from app.agents.llm import AgentError, Usage
from app.agents.recommendation import ContentRecommendationAgent, GapQuery
from app.agents.scoring import VisibilityScoringAgent
from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)

MAX_GAPS_FOR_RECOMMENDATIONS = 5


class _RunLogger(logging.LoggerAdapter):
    """Correlation-ID logging: every pipeline line carries its run uuid."""

    def process(self, msg, kwargs):
        return f"[run={self.extra['run_uuid']}] {msg}", kwargs


def start_run(profile_uuid: str) -> PipelineRun:
    run = PipelineRun(profile_uuid=profile_uuid, status="running")
    db.session.add(run)
    db.session.commit()
    return run


def execute_pipeline(profile_uuid: str, run_uuid: str) -> None:
    log = _RunLogger(logging.getLogger("pipeline"), {"run_uuid": run_uuid})
    run = db.session.get(PipelineRun, run_uuid)
    profile = db.session.get(BusinessProfile, profile_uuid)
    total = Usage()

    try:
        log.info("agent 1: discovering queries for %s", profile.domain)
        items, usage = QueryDiscoveryAgent().discover(profile)
        total.input_tokens += usage.input_tokens
        total.output_tokens += usage.output_tokens
        run.queries_discovered = len(items)
        log.info("agent 1: %d queries discovered", len(items))

        log.info("agent 2: scoring queries")
        scored, usage = VisibilityScoringAgent().score_all(profile, items)
        total.input_tokens += usage.input_tokens
        total.output_tokens += usage.output_tokens

        query_rows: list[DiscoveredQuery] = []
        for s in scored:
            row = DiscoveredQuery(
                profile_uuid=profile.uuid, run_uuid=run.uuid,
                query_text=s.question, keyword=s.keyword, intent=s.intent,
                estimated_search_volume=s.volume,
                competitive_difficulty=s.difficulty,
                opportunity_score=s.opportunity_score,
                domain_visible=s.visible, visibility_position=s.position,
            )
            db.session.add(row)
            query_rows.append(row)
        db.session.commit()
        run.queries_scored = len(query_rows)
        log.info("agent 2: %d queries scored", len(query_rows))

        gaps = sorted(
            (q for q in query_rows if q.domain_visible is False),
            key=lambda q: q.opportunity_score, reverse=True,
        )[:MAX_GAPS_FOR_RECOMMENDATIONS]
        if not gaps:  # fully visible profile: recommend on lowest-position queries
            gaps = sorted(query_rows, key=lambda q: q.opportunity_score,
                          reverse=True)[:MAX_GAPS_FOR_RECOMMENDATIONS]

        try:
            log.info("agent 3: recommending for %d gaps", len(gaps))
            gap_inputs = [
                GapQuery(query_uuid=g.uuid, question=g.query_text,
                         keyword=g.keyword, opportunity_score=g.opportunity_score)
                for g in gaps
            ]
            recs, usage = ContentRecommendationAgent().recommend(profile, gap_inputs)
            total.input_tokens += usage.input_tokens
            total.output_tokens += usage.output_tokens
            for r in recs:
                db.session.add(ContentRecommendation(
                    profile_uuid=profile.uuid, query_uuid=r.target_query_uuid,
                    run_uuid=run.uuid, content_type=r.content_type, title=r.title,
                    rationale=r.rationale, target_keywords=r.target_keywords,
                    priority=r.priority,
                ))
            log.info("agent 3: %d recommendations", len(recs))
        except AgentError as e:
            log.warning("agent 3 failed, completing run without recommendations: %s", e)
            run.error_message = f"recommendations unavailable: {e}"

        run.status = "completed"
        profile.status = "analyzed"
    except Exception as e:  # noqa: BLE001 — run must never crash the caller
        log.error("pipeline failed: %s", e)
        db.session.rollback()
        run = db.session.get(PipelineRun, run_uuid)
        run.status = "failed"
        run.error_message = str(e)
    finally:
        run.tokens_used = total.total
        run.completed_at = datetime.now(timezone.utc)
        db.session.commit()


def build_run_payload(run: PipelineRun) -> dict:
    top = (
        DiscoveredQuery.query.filter_by(run_uuid=run.uuid)
        .order_by(DiscoveredQuery.opportunity_score.desc())
        .limit(3).all()
    )
    recs = ContentRecommendation.query.filter_by(run_uuid=run.uuid).all()
    payload = run.to_dict()
    payload["top_queries"] = [q.to_dict() for q in top]
    payload["recommendations"] = [r.to_dict() for r in recs]
    return payload
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): pipeline orchestrator with partial-failure policy + correlation logging"`

---

### Task 11: Profile endpoints

**Files:**
- Modify: `backend/app/api/profiles.py`
- Test: `backend/tests/test_api_profiles.py`

**Interfaces:**
- Consumes: `ProfileCreate`, `ApiResponse`, models.
- Produces routes: `POST /api/v1/profiles` (201, spec body) · `GET /api/v1/profiles` (list w/ stats) · `GET /api/v1/profiles/<uuid>` (profile + stats).

- [ ] **Step 1: Write failing tests**

`backend/tests/test_api_profiles.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure** — Expected: 404/failed assertions.

- [ ] **Step 3: Implement**

Replace `backend/app/api/profiles.py`:
```python
from flask import Blueprint, request

from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery
from app.schemas.requests import ProfileCreate
from app.utils.responses import ApiResponse

profiles_bp = Blueprint("profiles", __name__)


def _stats(profile: BusinessProfile) -> dict:
    scores = [q.opportunity_score for q in profile.queries]
    last_run = profile.runs[0] if profile.runs else None
    return {
        "total_queries": len(profile.queries),
        "avg_opportunity_score": round(sum(scores) / len(scores), 4) if scores else None,
        "last_run_status": last_run.status if last_run else None,
        "last_run_at": last_run.to_dict()["started_at"] if last_run else None,
    }


@profiles_bp.post("/profiles")
def create_profile():
    data = ProfileCreate.model_validate(request.get_json(force=True, silent=True) or {})
    profile = BusinessProfile(
        name=data.name, domain=data.domain, industry=data.industry,
        description=data.description, competitors=data.competitors,
    )
    db.session.add(profile)
    db.session.commit()
    return ApiResponse.created({
        "profile_uuid": profile.uuid,
        "name": profile.name,
        "domain": profile.domain,
        "status": profile.status,
        "created_at": profile.to_dict()["created_at"],
    })


@profiles_bp.get("/profiles")
def list_profiles():
    profiles = BusinessProfile.query.order_by(BusinessProfile.created_at.desc()).all()
    return ApiResponse.ok({"items": [{**p.to_dict(), **_stats(p)} for p in profiles]})


@profiles_bp.get("/profiles/<uuid>")
def get_profile(uuid: str):
    profile = db.session.get(BusinessProfile, uuid)
    if profile is None:
        return ApiResponse.error("not_found", f"Profile {uuid} not found", 404)
    return ApiResponse.ok({**profile.to_dict(), **_stats(profile)})
```

Note: `DiscoveredQuery` import is used indirectly via relationships — remove it if the linter flags it.

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): profile endpoints with summary stats"`

---

### Task 12: Run endpoints (dual-mode) + run history

**Files:**
- Modify: `backend/app/api/profiles.py`
- Test: `backend/tests/test_api_runs.py`

**Interfaces:**
- Produces routes: `POST /api/v1/profiles/<uuid>/run` — sync by default (executes pipeline, returns `build_run_payload`), `?async=1` → 202 `{run_uuid, status: "running", poll: "/api/v1/runs/<uuid>"}`, rate-limited `5 per minute` · `GET /api/v1/runs/<run_uuid>` — full payload · `GET /api/v1/profiles/<uuid>/runs` — history list.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_api_runs.py`:
```python
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
```

- [ ] **Step 2: Run to verify failure** — Expected: 404s.

- [ ] **Step 3: Implement** — append to `backend/app/api/profiles.py`:

```python
# --- add to imports at top of file ---
import threading

from flask import current_app

from app.extensions import limiter
from app.models import PipelineRun
from app.services.pipeline import build_run_payload, execute_pipeline, start_run


# --- add routes ---
@profiles_bp.post("/profiles/<uuid>/run")
@limiter.limit("5 per minute")
def run_pipeline(uuid: str):
    profile = db.session.get(BusinessProfile, uuid)
    if profile is None:
        return ApiResponse.error("not_found", f"Profile {uuid} not found", 404)

    run = start_run(profile.uuid)

    if request.args.get("async") in ("1", "true"):
        app = current_app._get_current_object()

        def _background(profile_uuid: str, run_uuid: str) -> None:
            with app.app_context():
                # module-level lookup so tests can monkeypatch app.api.profiles.execute_pipeline
                from app.api import profiles as _self
                _self.execute_pipeline(profile_uuid, run_uuid)

        threading.Thread(
            target=_background, args=(profile.uuid, run.uuid), daemon=True
        ).start()
        return ApiResponse.ok(
            {"run_uuid": run.uuid, "status": "running",
             "poll": f"/api/v1/runs/{run.uuid}"},
            202,
        )

    execute_pipeline(profile.uuid, run.uuid)
    db.session.refresh(run)
    return ApiResponse.ok(build_run_payload(run))


@profiles_bp.get("/runs/<run_uuid>")
def get_run(run_uuid: str):
    run = db.session.get(PipelineRun, run_uuid)
    if run is None:
        return ApiResponse.error("not_found", f"Run {run_uuid} not found", 404)
    return ApiResponse.ok(build_run_payload(run))


@profiles_bp.get("/profiles/<uuid>/runs")
def run_history(uuid: str):
    profile = db.session.get(BusinessProfile, uuid)
    if profile is None:
        return ApiResponse.error("not_found", f"Profile {uuid} not found", 404)
    return ApiResponse.ok({"items": [r.to_dict() for r in profile.runs]})
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass (async test relies on the conftest StaticPool engine options).
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): dual-mode run endpoint + polling + history"`

---

### Task 13: Queries, recheck, recommendations endpoints

**Files:**
- Modify: `backend/app/api/queries.py`, `backend/app/api/profiles.py`
- Test: `backend/tests/test_api_queries.py`

**Interfaces:**
- Produces routes: `GET /api/v1/profiles/<uuid>/queries` (`min_score`, `status` ∈ visible|not_visible|unknown, `page`, `per_page` ≤100; sorted score desc; paginated) · `POST /api/v1/queries/<uuid>/recheck` (re-runs Agent 2 on one query, updates row, returns updated dict) · `GET /api/v1/profiles/<uuid>/recommendations`.

- [ ] **Step 1: Write failing tests**

`backend/tests/test_api_queries.py`:
```python
from app.agents.scoring import ScoredQuery
from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)

VALID = {"name": "Frase", "domain": "frase.io", "industry": "SEO",
         "description": "", "competitors": []}


def _seed(client):
    uuid = client.post("/api/v1/profiles", json=VALID).get_json()["profile_uuid"]
    run = PipelineRun(profile_uuid=uuid, status="completed")
    db.session.add(run)
    db.session.commit()
    rows = [
        DiscoveredQuery(profile_uuid=uuid, run_uuid=run.uuid, query_text=f"Q{i}?",
                        keyword=f"kw{i}", intent="commercial",
                        estimated_search_volume=i * 100,
                        competitive_difficulty=50,
                        opportunity_score=i / 10,
                        domain_visible=(None if i == 0 else i % 2 == 0))
        for i in range(5)  # scores 0.0..0.4; i=0 unknown
    ]
    db.session.add_all(rows)
    db.session.commit()
    return uuid, run, rows


def test_queries_sorted_desc_and_paginated(client):
    uuid, _, _ = _seed(client)
    res = client.get(f"/api/v1/profiles/{uuid}/queries?page=1&per_page=2")
    assert res.status_code == 200
    body = res.get_json()
    assert body["pagination"]["total"] == 5
    scores = [q["opportunity_score"] for q in body["items"]]
    assert scores == sorted(scores, reverse=True) and len(scores) == 2


def test_queries_min_score_filter(client):
    uuid, _, _ = _seed(client)
    body = client.get(f"/api/v1/profiles/{uuid}/queries?min_score=0.3").get_json()
    assert all(q["opportunity_score"] >= 0.3 for q in body["items"])
    assert body["pagination"]["total"] == 2


def test_queries_status_filter(client):
    uuid, _, _ = _seed(client)
    unknown = client.get(f"/api/v1/profiles/{uuid}/queries?status=unknown").get_json()
    assert unknown["pagination"]["total"] == 1
    not_visible = client.get(
        f"/api/v1/profiles/{uuid}/queries?status=not_visible").get_json()
    assert all(q["domain_visible"] is False for q in not_visible["items"])


def test_queries_invalid_status_400(client):
    uuid, _, _ = _seed(client)
    res = client.get(f"/api/v1/profiles/{uuid}/queries?status=banana")
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "invalid_parameter"


def test_recheck_updates_row(client, monkeypatch):
    uuid, _, rows = _seed(client)
    target = rows[0]

    def fake_single(self, profile, question, keyword, intent):
        return ScoredQuery(question=question, keyword=keyword, intent=intent,
                           volume=999, difficulty=10, visible=True, position=1,
                           opportunity_score=0.77)

    monkeypatch.setattr(
        "app.api.queries.VisibilityScoringAgent.score_single", fake_single)
    res = client.post(f"/api/v1/queries/{target.uuid}/recheck")
    assert res.status_code == 200
    body = res.get_json()
    assert body["domain_visible"] is True
    assert body["opportunity_score"] == 0.77
    assert body["estimated_search_volume"] == 999


def test_recommendations_endpoint(client):
    uuid, run, rows = _seed(client)
    db.session.add(ContentRecommendation(
        profile_uuid=uuid, query_uuid=rows[0].uuid, run_uuid=run.uuid,
        content_type="blog_post", title="T", rationale="R",
        target_keywords=["k"], priority="high"))
    db.session.commit()
    res = client.get(f"/api/v1/profiles/{uuid}/recommendations")
    assert res.status_code == 200
    items = res.get_json()["items"]
    assert items[0]["target_query_uuid"] == rows[0].uuid
    assert items[0]["priority"] == "high"
```

- [ ] **Step 2: Run to verify failure** — Expected: 404s.

- [ ] **Step 3: Implement**

Replace `backend/app/api/queries.py`:
```python
from flask import Blueprint, request

from app.agents.scoring import VisibilityScoringAgent
from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery
from app.utils.responses import ApiResponse

queries_bp = Blueprint("queries", __name__)

_STATUS_FILTERS = {"visible": True, "not_visible": False, "unknown": None}
MAX_PER_PAGE = 100


@queries_bp.get("/profiles/<uuid>/queries")
def list_queries(uuid: str):
    profile = db.session.get(BusinessProfile, uuid)
    if profile is None:
        return ApiResponse.error("not_found", f"Profile {uuid} not found", 404)

    q = DiscoveredQuery.query.filter_by(profile_uuid=uuid)

    min_score = request.args.get("min_score", type=float)
    if min_score is not None:
        q = q.filter(DiscoveredQuery.opportunity_score >= min_score)

    status = request.args.get("status")
    if status is not None:
        if status not in _STATUS_FILTERS:
            return ApiResponse.error(
                "invalid_parameter",
                "status must be one of: visible, not_visible, unknown", 400)
        q = q.filter(DiscoveredQuery.domain_visible.is_(_STATUS_FILTERS[status]))

    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), MAX_PER_PAGE)

    total = q.count()
    items = (q.order_by(DiscoveredQuery.opportunity_score.desc())
             .offset((page - 1) * per_page).limit(per_page).all())
    return ApiResponse.paginated([i.to_dict() for i in items], page, per_page, total)


@queries_bp.post("/queries/<uuid>/recheck")
def recheck_query(uuid: str):
    query = db.session.get(DiscoveredQuery, uuid)
    if query is None:
        return ApiResponse.error("not_found", f"Query {uuid} not found", 404)

    profile = db.session.get(BusinessProfile, query.profile_uuid)
    scored = VisibilityScoringAgent().score_single(
        profile, query.query_text, query.keyword, query.intent)

    query.estimated_search_volume = scored.volume
    query.competitive_difficulty = scored.difficulty
    query.domain_visible = scored.visible
    query.visibility_position = scored.position
    query.opportunity_score = scored.opportunity_score
    db.session.commit()
    return ApiResponse.ok(query.to_dict())
```

Append to `backend/app/api/profiles.py`:
```python
# --- add import at top ---
from app.models import ContentRecommendation


# --- add route ---
@profiles_bp.get("/profiles/<uuid>/recommendations")
def list_recommendations(uuid: str):
    profile = db.session.get(BusinessProfile, uuid)
    if profile is None:
        return ApiResponse.error("not_found", f"Profile {uuid} not found", 404)
    recs = (ContentRecommendation.query.filter_by(profile_uuid=uuid)
            .order_by(ContentRecommendation.created_at.desc()).all())
    return ApiResponse.ok({"items": [r.to_dict() for r in recs]})
```

- [ ] **Step 4: Run tests** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): queries list w/ filters, recheck, recommendations endpoints"`

---

### Task 14: Rate-limit test + .env.example

**Files:**
- Create: `backend/.env.example`
- Test: `backend/tests/test_rate_limit.py`

- [ ] **Step 1: Write the rate-limit test**

`backend/tests/test_rate_limit.py`:
```python
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
```

- [ ] **Step 2: Run** — `uv run pytest tests/test_rate_limit.py -q` — Expected: PASS (limiter was wired in Tasks 1/12). If FAIL, fix wiring, not the test.

- [ ] **Step 3: Verify `.env.example`** (already created earlier and updated by the provider swap — confirm it matches the current env schema: `ANTHROPIC_API_KEY`, `SERANKING_API_KEY`, `DATABASE_URL`, `SECRET_KEY`, `FLASK_ENV`, `CORS_ORIGINS`, `RATELIMIT_ENABLED`)

- [ ] **Step 4: Full suite** — `uv run pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** — `git add backend && git commit -m "test(backend): rate limiting + env template"`

---

### Task 15: Docker + backend README + cold-run verification

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`, `d:\Assment\docker-compose.yml`, `backend/README.md`

- [ ] **Step 1: Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 FLASK_APP=app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 5000
CMD ["sh", "-c", "uv run flask db upgrade && uv run flask run --host=0.0.0.0 --port=5000"]
```

`backend/.dockerignore`:
```
.venv/
__pycache__/
*.pyc
instance/
*.db
.env
.pytest_cache/
tests/
```

- [ ] **Step 2: docker-compose (root)**

`d:\Assment\docker-compose.yml`:
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    env_file:
      - ./backend/.env
    volumes:
      - backend_db:/app/instance
    # frontend service added by the frontend implementation plan

volumes:
  backend_db:
```

- [ ] **Step 3: Backend README**

`backend/README.md` — write with exactly these sections (content per spec §5; formula table copied from `app/utils/scoring.py` docstring):
1. **What this is** — 3-agent AI visibility pipeline, one paragraph.
2. **Setup (< 5 min)** — prerequisites (uv, or Docker); `cp .env.example .env` + fill 3 keys; `uv sync && uv run flask db upgrade && uv run flask run`; or `docker-compose up` from repo root; `uv run pytest` (works with no keys).
3. **API reference** — table of all 9 endpoints w/ example curl for create → run → queries.
4. **Architecture decisions** — app factory + blueprints; ApiResponse single construction point (bare success bodies to match the assessment's documented responses); agent separation (3 classes, orchestrator, failure policy: A1 fail→run fails, A2 per-query isolation, A3 fail→run completes without recs); dual-mode execution (why sync default + `?async=1` thread over Celery).
5. **Model selection (deliberate)** — Opus 4.8 for generation quality on Agents 1&3 (structured outputs via `messages.parse`), Haiku 4.5 for 15–20 parallel visibility probes (speed/cost, consumer-chatbot simulation); provider portability = reimplement `app/agents/llm.py` only.
6. **Opportunity score formula** — weights table + factor rationale + the `unknown → gap 0.7` decision.
7. **Real data & the provider story** — SE Ranking Keyword Research API: ONE batched call per run (`/v1/keywords/export`, 100 credits flat, 100K free ≈ 1,000 runs), returns volume + difficulty together; graceful degradation policy. Tell the swap story honestly: started on DataForSEO (the brief's named example) → its trial proved account-gated (40104 verification wall, then 40201 activity pause) → because all provider code was isolated in one module, the swap touched exactly one file + two import lines, live-verified same day. Note DataForSEO's LLM Mentions API as the production upgrade path for cross-model visibility checks.
8. **Prompt engineering** — where prompts live, schema-in-prompt + `parse()` enforcement + retry/fallback layers; probe prompt never names the target (bias).
9. **Tradeoffs & honest limitations** — visibility simulated via Claude (not actual ChatGPT), volume keyed to extracted keyword not full question, SQLite, in-process thread (single worker) for async.
10. **AI tools disclosure** — per assessment requirement.

- [ ] **Step 4: Cold-run verification**

Run from repo root: `docker compose up --build -d` then:
```bash
curl -s -X POST http://localhost:5000/api/v1/profiles -H "Content-Type: application/json" -d "{\"name\":\"Frase\",\"domain\":\"frase.io\",\"industry\":\"SEO Content Tools\",\"description\":\"AI briefs\",\"competitors\":[\"surferseo.com\",\"clearscope.io\"]}"
```
Expected: 201 JSON with `profile_uuid`.
With real keys in `backend/.env`: `curl -s -X POST http://localhost:5000/api/v1/profiles/<uuid>/run` — Expected: completed payload with real volumes, visibility booleans, 3-5 recommendations, tokens_used > 0. Without keys: run completes with `unknown` visibility + volume 0 and `error_message` noting degradation — verifying graceful behavior.
Then: `docker compose down`.

- [ ] **Step 5: Full suite + commit**

Run: `uv run pytest -q` — Expected: all pass.
`git add -A && git commit -m "feat(backend): Docker, compose, README — Task 1 complete"`

---

## Plan self-review (done at write time)

- **Spec coverage:** all 6 spec endpoints + 3 additions ✓ · 3 agents + orchestrator + partial failure ✓ · dual-mode ✓ · score formula ✓ · migrations ✓ · rate limit ✓ · correlation logging ✓ · Pydantic ✓ · Docker/compose ✓ · README ✓ · `.env.example` ✓. Frontend intentionally out of scope (separate plan).
- **Placeholder scan:** README task specifies exact section content rather than full prose (deliberate: prose duplicates decisions already coded/documented in this plan — the implementer copies from the referenced sources). No TBDs elsewhere.
- **Type consistency:** `ScoredQuery`/`GapQuery`/`Usage` signatures match across Tasks 8→10→13; `execute_pipeline(profile_uuid, run_uuid)` consistent in Tasks 10→12→14; `ApiResponse` API consistent throughout.
