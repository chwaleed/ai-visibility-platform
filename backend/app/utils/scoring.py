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
    # visible with position=None (possible via manual/legacy data) counts as not-first -> 0.4
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
