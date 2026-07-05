"""Agent 2 — Visibility Scoring.

For each discovered query:
1. Real search volume + difficulty (SE Ranking, batched once per run).
2. Visibility probes: Haiku answers the question NATURALLY (the prompt never
   mentions the target business — mentioning it would bias the simulation),
   then deterministic string-matching detects which brands appear and in
   what order. PROBE_SAMPLES independent answers are sampled per query and
   visibility is decided by majority vote — self-consistency (Wang et al.
   2022, arXiv:2203.11171) — because a single sampled answer flips
   run-to-run on borderline queries.
3. Multi-factor opportunity score.

Per-query failures mark that query unknown and never abort the run.
"""
import logging
import statistics
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from app.agents.seranking import fetch_keyword_metrics, normalize_keyword
from app.agents.llm import PROBE_MODEL, Usage, generate_text
from app.agents.prompts import SCORING_PROBE_SYSTEM
from app.models import BusinessProfile
from app.schemas.agent_outputs import DiscoveredQueryItem
from app.utils.scoring import compute_opportunity_score

logger = logging.getLogger("agents.scoring")

MAX_PROBE_WORKERS = 5
PROBE_SAMPLES = 3   # self-consistency votes per query (odd → fewer ties)
DEFAULT_VOLUME = 0
DEFAULT_DIFFICULTY = 50


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


def _majority_vote(
    samples: list[tuple[bool | None, int | None]],
) -> tuple[bool | None, int | None]:
    """Self-consistency vote across probe samples (Wang et al. 2022).

    Failed samples (None) don't vote. Majority visible → True with the median
    position; majority absent → False. A tie or zero usable samples is genuine
    uncertainty → None ("unknown"), which the score formula treats as
    opportunity-leaning (gap 0.7) rather than assuming either outcome.
    """
    votes = [(v, p) for v, p in samples if v is not None]
    if not votes:
        return None, None
    yes_positions = [p for v, p in votes if v and p is not None]
    yes, no = len([1 for v, _ in votes if v]), len([1 for v, _ in votes if not v])
    if yes > no:
        return True, statistics.median_low(yes_positions) if yes_positions else None
    if no > yes:
        return False, None
    return None, None


class VisibilityScoringAgent:
    def score_all(
        self, profile: BusinessProfile, items: list[DiscoveredQueryItem],
    ) -> tuple[list[ScoredQuery], Usage]:
        keywords = [i.keyword for i in items]
        volumes, difficulties = fetch_keyword_metrics(keywords)

        total = Usage()
        target = brand_variants(profile.domain, profile.name)
        competitors = [brand_variants(c) for c in profile.competitors]

        def probe_once(item: DiscoveredQueryItem) -> tuple[bool | None, int | None, Usage]:
            try:
                answer, usage = generate_text(SCORING_PROBE_SYSTEM, item.question,
                                              model=PROBE_MODEL)
                visible, position = extract_visibility(answer, target, competitors)
                return visible, position, usage
            except Exception as e:  # noqa: BLE001 — isolate per-sample failures
                logger.warning("visibility probe failed for %r: %s", item.question, e)
                return None, None, Usage()

        # Flatten (query × sample) into one pool so samples run as parallel as
        # queries do; pool.map preserves order, so slicing recovers each query.
        tasks = [item for item in items for _ in range(PROBE_SAMPLES)]
        with ThreadPoolExecutor(max_workers=MAX_PROBE_WORKERS) as pool:
            flat = list(pool.map(probe_once, tasks))

        scored: list[ScoredQuery] = []
        # Usage is summed here in the main thread — `+=` from inside worker
        # threads would be a read-modify-write race and could drop updates.
        for i, item in enumerate(items):
            samples = flat[i * PROBE_SAMPLES:(i + 1) * PROBE_SAMPLES]
            for _, _, u in samples:
                total.input_tokens += u.input_tokens
                total.output_tokens += u.output_tokens
            visible, position = _majority_vote([(v, p) for v, p, _ in samples])

            kw = normalize_keyword(item.keyword)
            volume = volumes.get(kw, DEFAULT_VOLUME)
            difficulty = difficulties.get(kw, DEFAULT_DIFFICULTY)
            scored.append(ScoredQuery(
                question=item.question, keyword=item.keyword, intent=item.intent,
                volume=volume, difficulty=difficulty,
                visible=visible, position=position,
                opportunity_score=compute_opportunity_score(
                    volume, difficulty, visible, position, item.intent),
            ))
        return scored, total

    def score_single(
        self, profile: BusinessProfile, question: str, keyword: str, intent: str,
    ) -> ScoredQuery:
        item = DiscoveredQueryItem(question=question, keyword=keyword, intent=intent)
        scored, _ = self.score_all(profile, [item])
        return scored[0]
