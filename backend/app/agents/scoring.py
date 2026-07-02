"""Agent 2 — Visibility Scoring.

For each discovered query:
1. Real search volume + difficulty (SE Ranking, batched once per run).
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

from app.agents.seranking import fetch_keyword_metrics
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


def _first_index(compact_answer: str, variants: list[str]) -> int | None:
    """First occurrence of any variant, measured in space-stripped space."""
    hits = [idx for v in variants if (idx := compact_answer.find(v.replace(" ", "").replace("-", ""))) != -1]
    return min(hits) if hits else None


def extract_visibility(
    answer: str, target_variants: list[str], competitor_variants: list[list[str]],
) -> tuple[bool, int | None]:
    """(visible, position) — position is the target's 1-based rank among all
    brands mentioned, ordered by first occurrence in the answer.

    Matching happens in space-stripped lowercase text so an answer writing a
    brand with spacing ("Surfer SEO") still matches its domain root
    ("surferseo") — no fragile single-word heuristics needed.
    """
    # ponytail: space/hyphen-stripped matching can false-positive across word boundaries; acceptable ceiling — upgrade to token-aware matching if it bites.
    compact = answer.lower().replace(" ", "").replace("-", "")
    target_idx = _first_index(compact, target_variants)
    if target_idx is None:
        return False, None
    competitor_idxs = [
        idx for cv in competitor_variants
        if (idx := _first_index(compact, cv)) is not None
    ]
    position = 1 + sum(1 for idx in competitor_idxs if idx < target_idx)
    return True, position


class VisibilityScoringAgent:
    def score_all(
        self, profile: BusinessProfile, items: list[DiscoveredQueryItem],
    ) -> tuple[list[ScoredQuery], Usage]:
        keywords = [i.keyword for i in items]
        volumes, difficulties = fetch_keyword_metrics(keywords)

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
