import secrets

from passlib.context import CryptContext
from passlib.exc import UnknownHashError

# Configuration du contexte de hash
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

OAUTH_NO_PASSWORD_PREFIX = "oauth_no_password$"


def build_oauth_placeholder_password() -> str:
    """
    Creates a non-hash sentinel value meaning:
    account exists but no local password has been set yet.
    """
    return f"{OAUTH_NO_PASSWORD_PREFIX}{secrets.token_urlsafe(24)}"


def has_local_password(hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    return not hashed_password.startswith(OAUTH_NO_PASSWORD_PREFIX)

def get_password_hash(password: str) -> str:
    """
    Hash un mot de passe en clair.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Vérifie un mot de passe en clair contre un hash.
    """
    if not has_local_password(hashed_password):
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (UnknownHashError, ValueError):
        return False
