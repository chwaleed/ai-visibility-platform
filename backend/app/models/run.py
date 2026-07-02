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
