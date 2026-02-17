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
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    AUTH_COOKIE_NAME: str = "seqpulse_session"
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_SECURE: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
