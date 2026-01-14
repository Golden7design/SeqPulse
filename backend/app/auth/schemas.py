import re
from pydantic import BaseModel, EmailStr, Field, field_validator

# Regex utilitaires
UPPERCASE_REGEX = re.compile(r"[A-Z]")
LOWERCASE_REGEX = re.compile(r"[a-z]")
DIGIT_REGEX = re.compile(r"\d")
SPECIAL_CHAR_REGEX = re.compile(r"[@$!%*?&]")


class UserCreate(BaseModel):
    email: EmailStr = Field(
        ...,
        description="Adresse email valide",
        examples=["user@email.com"],
    )

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description=(
            "Mot de passe sécurisé : "
            "au moins 8 caractères, 1 majuscule, "
            "1 minuscule, 1 chiffre et 1 caractère spécial"
        ),
        examples=["StrongP@ssw0rd"],
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        if len(password) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")

        if not UPPERCASE_REGEX.search(password):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule.")

        if not LOWERCASE_REGEX.search(password):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule.")

        if not DIGIT_REGEX.search(password):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre.")

        if not SPECIAL_CHAR_REGEX.search(password):
            raise ValueError(
                "Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)."
            )

        return password


class UserLogin(BaseModel):
    email: EmailStr = Field(
        ...,
        description="Adresse email de connexion",
        examples=["user@email.com"],
    )
    password: str = Field(
        ...,
        description="Mot de passe du compte",
        examples=["StrongP@ssw0rd"],
    )


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
