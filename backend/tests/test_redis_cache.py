from unittest.mock import MagicMock

from app.crimeisdown.state import LegacyRedisState, MemoryState


def cache():
    state = LegacyRedisState(MemoryState(), "redis://127.0.0.1:1/0", "laravel:")
    state.redis = MagicMock()
    return state


def test_existing_laravel_numeric_budget_and_php_search_key_are_readable():
    state = cache()
    state.redis.get.return_value = b"3"
    assert state.get("archive-download:42") == 3
    state.redis.get.return_value = b's:6:"search";'
    assert state.get("42_search_key") == "search"
    state.redis.get.return_value = b'O:1:"A":0:{}'
    assert state.get("42_search_key") is None


def test_expired_shared_budget_is_not_resurrected_by_private_cache():
    state = cache()
    state.primary.set("archive-download:42", 99, 3600)
    state.redis.get.return_value = None
    assert state.get("archive-download:42") is None
    state.set("42_search_key", "new-key", 60)
    state.redis.set.assert_called_once_with(
        "laravel:42_search_key", b's:7:"new-key";', ex=60
    )
    state.set("private-session", {"other": True}, 60)
    assert state.get("private-session") == {"other": True}
