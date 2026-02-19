import re
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator

# Regex utilitaires
UPPERCASE_REGEX = re.compile(r"[A-Z]")
LOWERCASE_REGEX = re.compile(r"[a-z]")
DIGIT_REGEX = re.compile(r"\d")
SPECIAL_CHAR_REGEX = re.compile(r"[@$!%*?&]")


def _validate_password_strength_value(password: str) -> str:
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


class UserCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Nom complet ou pseudonyme",
        examples=["Nassir", "John Doe"],
    )
    
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

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("Le nom ne peut pas être vide.")
        if len(name) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caractères.")
        if not re.match(r"^[a-zA-ZÀ-ÿ\s\-']+$", name):
            raise ValueError("Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes.")
        return name

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        return _validate_password_strength_value(password)


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

class UserResponse(BaseModel):
    name: str
    email: EmailStr

    class Config:
        from_attributes = True  # pour compatibilité SQLAlchemy (anciennement orm_mode)


class UserUpdateProfile(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Nouveau nom complet ou pseudonyme",
        examples=["Nassir", "John Doe"],
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("Le nom ne peut pas être vide.")
        if len(name) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caractères.")
        if not re.match(r"^[a-zA-ZÀ-ÿ\s\-']+$", name):
            raise ValueError("Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes.")
        return name


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, password: str) -> str:
        return _validate_password_strength_value(password)


class SetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, password: str) -> str:
        return _validate_password_strength_value(password)


class MessageResponse(BaseModel):
    message: str


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    challenge_id: UUID | None = None
    challenge_expires_at: datetime | None = None


class TwoFAChallengeSessionResponse(BaseModel):
    requires_2fa: bool = False
    challenge_id: UUID | None = None
    challenge_expires_at: datetime | None = None


class TwoFAStatusResponse(BaseModel):
    enabled: bool
    has_setup_secret: bool
    recovery_codes_remaining: int


class TwoFASetupStartResponse(BaseModel):
    secret: str
    otpauth_uri: str
    issuer: str
    digits: int
    period: int


class TwoFASetupVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=12)


class TwoFARecoveryCodesResponse(BaseModel):
    message: str
    recovery_codes: list[str]
    recovery_codes_remaining: int


class TwoFAChallengeVerifyRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)
    challenge_id: UUID | None = None
    use_recovery_code: bool = False


class TwoFADisableRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)
    use_recovery_code: bool = False


class TwoFARegenerateRecoveryCodesRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)
    use_recovery_code: bool = False
