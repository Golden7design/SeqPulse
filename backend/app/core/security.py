from passlib.context import CryptContext

# Configuration du contexte de hash
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

def get_password_hash(password: str) -> str:
    """
    Hash un mot de passe en clair.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Vérifie un mot de passe en clair contre un hash.
    """
    return pwd_context.verify(plain_password, hashed_password)
