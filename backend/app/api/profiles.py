from flask import Blueprint, request

from app.extensions import db
from app.models import BusinessProfile
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
