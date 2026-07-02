import threading

from flask import Blueprint, current_app, request

from app.extensions import db, limiter
from app.models import BusinessProfile, PipelineRun
from app.schemas.requests import ProfileCreate
from app.services.pipeline import build_run_payload, execute_pipeline, start_run
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
