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
