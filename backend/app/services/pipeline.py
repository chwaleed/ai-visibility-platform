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
        if not gaps:  # fully visible profile: recommend on top-scored queries anyway
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
