from app.utils.scoring import compute_opportunity_score as score


def test_bounds():
    assert 0.0 <= score(0, 100, True, 1, "informational") <= 1.0
    assert 0.0 <= score(10**7, 0, False, None, "transactional") <= 1.0


def test_more_volume_scores_higher():
    assert score(10000, 50, False, None, "commercial") > score(100, 50, False, None, "commercial")


def test_lower_difficulty_scores_higher():
    assert score(1000, 20, False, None, "commercial") > score(1000, 80, False, None, "commercial")


def test_gap_ordering_not_visible_beats_visible():
    not_visible = score(1000, 50, False, None, "commercial")
    unknown = score(1000, 50, None, None, "commercial")
    visible_late = score(1000, 50, True, 3, "commercial")
    visible_first = score(1000, 50, True, 1, "commercial")
    assert not_visible > unknown > visible_late > visible_first


def test_intent_ordering():
    t = score(1000, 50, False, None, "transactional")
    c = score(1000, 50, False, None, "commercial")
    i = score(1000, 50, False, None, "informational")
    assert t > c > i


def test_max_realistic_case_near_one():
    assert score(500_000, 5, False, None, "transactional") > 0.9
