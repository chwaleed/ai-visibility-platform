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
