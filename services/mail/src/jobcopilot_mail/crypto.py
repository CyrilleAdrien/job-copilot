"""Chiffrement des mots de passe d'application IMAP, avec une clé maître lue dans .env."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from jobcopilot_mail.settings import get_mail_settings


class SecretKeyMissing(Exception):
    pass


def fernet() -> Fernet:
    secret = get_mail_settings().secret_key
    if len(secret) < 16:
        raise SecretKeyMissing(
            "SECRET_KEY manque dans .env : lance `make secret`, puis redémarre le service mail."
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
