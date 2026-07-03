"""Real search data via SE Ranking's Keyword Research API (assessment
requirement: no invented numbers).

One request returns volume AND difficulty for up to 5,000 keywords
(100 credits flat), so the pipeline makes a single data call per run.
Degrades to empty results on ANY failure — the pipeline then scores with
neutral defaults instead of crashing (partial-failure requirement).

Provider history: the brief's example provider (DataForSEO) gates its trial
behind account verification; swapping to SE Ranking touched only this module —
see README "Real data" section.
"""
import logging
import os

import requests

logger = logging.getLogger("agents.seranking")

EXPORT_URL = "https://api.seranking.com/v1/keywords/export"
SOURCE = "us"
TIMEOUT = 30
DEFAULT_DIFFICULTY = 50


def _api_key() -> str:
    return os.environ.get("SERANKING_API_KEY", "")


def normalize_keyword(kw: str) -> str:
    """Canonical form for keyed lookups. SE Ranking echoes keywords lowercased,
    but Agent 1 emits them with capitals (acronyms, brand names) — normalize both
    the stored keys and the caller's lookups through here so they still match."""
    return kw.strip().lower()


def fetch_keyword_metrics(
    keywords: list[str],
) -> tuple[dict[str, int], dict[str, int]]:
    """(volumes, difficulties) keyed by keyword. ({}, {}) on ANY failure."""
    key = _api_key()
    if not key:
        logger.warning("SERANKING_API_KEY missing — skipping real-data call")
        return {}, {}
    try:
        res = requests.post(
            EXPORT_URL,
            params={"source": SOURCE},
            headers={"Authorization": f"Token {key}"},
            json={"keywords": keywords},
            timeout=TIMEOUT,
        )
        res.raise_for_status()
        items = res.json()
        if not isinstance(items, list):
            logger.warning("SE Ranking returned unexpected payload shape")
            return {}, {}
        volumes: dict[str, int] = {}
        difficulties: dict[str, int] = {}
        for item in items:
            kw = (item or {}).get("keyword")
            if not kw:
                continue
            norm = normalize_keyword(kw)
            volumes[norm] = int(item.get("volume") or 0)
            difficulties[norm] = int(item.get("difficulty") or DEFAULT_DIFFICULTY)
        return volumes, difficulties
    except Exception as e:  # noqa: BLE001 — any failure degrades gracefully
        logger.warning("SE Ranking call failed: %s", e)
        return {}, {}
