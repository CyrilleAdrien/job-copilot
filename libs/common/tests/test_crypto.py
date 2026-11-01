import pytest

from jobcopilot_common import crypto, get_settings


@pytest.fixture
def secret_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "secret_key", "a-long-enough-test-secret-key")


def test_round_trip_never_contains_the_password(secret_key):
    token = crypto.encrypt("abcd efgh ijkl mnop")
    assert "abcd" not in token
    assert crypto.decrypt(token) == "abcd efgh ijkl mnop"


def test_same_password_gives_different_tokens(secret_key):
    assert crypto.encrypt("same") != crypto.encrypt("same")


def test_short_or_missing_key_is_refused(monkeypatch):
    for key in ("", "too-short"):
        monkeypatch.setattr(get_settings(), "secret_key", key)
        with pytest.raises(crypto.SecretKeyMissing):
            crypto.encrypt("x")


def test_changed_key_is_reported_without_leaking(monkeypatch):
    monkeypatch.setattr(get_settings(), "secret_key", "the-first-secret-key-value")
    token = crypto.encrypt("hunter2")
    monkeypatch.setattr(get_settings(), "secret_key", "the-second-secret-key-value")
    with pytest.raises(crypto.SecretKeyMissing) as error:
        crypto.decrypt(token)
    assert "hunter2" not in str(error.value)
    assert "SECRET_KEY" in str(error.value)
