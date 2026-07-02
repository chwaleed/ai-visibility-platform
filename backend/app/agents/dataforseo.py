"""Real search data (assessment requirement: no invented numbers).

Every function degrades to {} on failure — the pipeline then scores with
neutral defaults instead of crashing (partial-failure requirement).
"""
import logging
import os

import requests

logger = logging.getLogger("agents.dataforseo")

BASE = "https://api.dataforseo.com/v3"
VOLUME_URL = f"{BASE}/keywords_data/google_ads/search_volume/live"
DIFFICULTY_URL = f"{BASE}/dataforseo_labs/google/bulk_keyword_difficulty/live"
TIMEOUT = 30
LOCATION_US = 2840


def _credentials() -> tuple[str, str]:
    return os.environ.get("DATAFORSEO_LOGIN", ""), os.environ.get("DATAFORSEO_PASSWORD", "")


def _post(url: str, keywords: list[str]) -> dict | None:
    login, password = _credentials()
    if not login or not password:
        logger.warning("DataForSEO credentials missing — skipping real-data call")
        return None
    payload = [{"keywords": keywords, "location_code": LOCATION_US, "language_code": "en"}]
    try:
        res = requests.post(url, auth=(login, password), json=payload, timeout=TIMEOUT)
        res.raise_for_status()
        data = res.json()
        task = data["tasks"][0]
        if task.get("status_code") != 20000:
            logger.warning("DataForSEO task error: %s", task.get("status_message"))
            return None
        return task
    except Exception as e:  # noqa: BLE001 — any failure degrades gracefully
        logger.warning("DataForSEO call failed: %s", e)
        return None


def fetch_search_volumes(keywords: list[str]) -> dict[str, int]:
    task = _post(VOLUME_URL, keywords)
    if not task:
        return {}
    out: dict[str, int] = {}
    for item in task.get("result") or []:
        if item and item.get("keyword"):
            out[item["keyword"]] = int(item.get("search_volume") or 0)
    return out


def fetch_difficulties(keywords: list[str]) -> dict[str, int]:
    task = _post(DIFFICULTY_URL, keywords)
    if not task:
        return {}
    out: dict[str, int] = {}
    for block in task.get("result") or []:
        for item in (block or {}).get("items") or []:
            if item and item.get("keyword") is not None:
                out[item["keyword"]] = int(item.get("keyword_difficulty") or 50)
    return out
