"""Chiffrement des secrets stockés en base (Fernet), avec la clé maître SECRET_KEY de .env."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from jobcopilot_common.config import get_settings

MIN_KEY_LENGTH = 16


class SecretKeyMissing(Exception):
    pass


def fernet() -> Fernet:
    secret = get_settings().secret_key
    if len(secret) < MIN_KEY_LENGTH:
        raise SecretKeyMissing(
            "SECRET_KEY manque dans .env : lance `make secret`, puis redémarre les services."
        )
    # N'importe quelle chaîne longue convient : on en dérive une clé Fernet de 32 octets.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def encrypt(password: str) -> str:
    return fernet().encrypt(password.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise SecretKeyMissing(
            "Mot de passe illisible : SECRET_KEY a changé depuis l'ajout du compte. "
            "Supprime le compte et ajoute-le de nouveau."
        ) from exc
