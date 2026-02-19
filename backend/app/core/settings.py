from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"

    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DATABASE_URL: str
    SECRET_KEY: str
    JWT_ALGORITHM: str
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int
    FRONTEND_URL: str = "http://localhost:3000"
    EMAIL_PROVIDER: str = "resend"
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@seqpulse.dev"
    EMAIL_REPLY_TO: str = "support@seqpulse.dev"
    EMAIL_CTA_DASHBOARD_PATH: str = "/dashboard"
    EMAIL_CTA_PRICING_PATH: str = "/pricing"
    EMAIL_CTA_ONBOARDING_PATH: str = "/projects/new"
    EMAIL_MARKETING_COOLDOWN_HOURS: int = 24
    EMAIL_ENABLED_TYPES: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    AUTH_COOKIE_NAME: str = "seqpulse_session"
    AUTH_PREAUTH_COOKIE_NAME: str = "seqpulse_2fa_preauth"
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_SECURE: bool = False
    TWOFA_ISSUER: str = "SEQPULSE"
    TWOFA_ENCRYPTION_KEY: str = ""
    TWOFA_CODE_DIGITS: int = 6
    TWOFA_PERIOD_SECONDS: int = 30
    TWOFA_VALID_WINDOW: int = 1
    TWOFA_RECOVERY_CODES_COUNT: int = 10
    TWOFA_CHALLENGE_TTL_SECONDS: int = 300
    TWOFA_CHALLENGE_MAX_ATTEMPTS: int = 5
    TWOFA_PREAUTH_TTL_SECONDS: int = 300

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
