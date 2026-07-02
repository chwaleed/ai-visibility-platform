from flask import Blueprint, Response, request

from app.agents.scoring import VisibilityScoringAgent
from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery
from app.utils.responses import ApiResponse

queries_bp = Blueprint("queries", __name__)

_STATUS_FILTERS = {"visible": True, "not_visible": False, "unknown": None}
MAX_PER_PAGE = 100


@queries_bp.get("/profiles/<uuid>/queries")
def list_queries(uuid: str) -> tuple[Response, int]:
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
def recheck_query(uuid: str) -> tuple[Response, int]:
    query = db.session.get(DiscoveredQuery, uuid)
    if query is None:
        return ApiResponse.error("not_found", f"Query {uuid} not found", 404)

    profile = db.session.get(BusinessProfile, query.profile_uuid)
    if profile is None:
        return ApiResponse.error(
            "not_found", f"Profile {query.profile_uuid} not found", 404)

    scored = VisibilityScoringAgent().score_single(
        profile, query.query_text, query.keyword, query.intent)

    query.estimated_search_volume = scored.volume
    query.competitive_difficulty = scored.difficulty
    query.domain_visible = scored.visible
    query.visibility_position = scored.position
    query.opportunity_score = scored.opportunity_score
    db.session.commit()
    return ApiResponse.ok(query.to_dict())
