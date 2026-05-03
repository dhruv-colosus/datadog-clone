from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    password_min_length: int = 8

    frontend_url: str = "http://localhost:3000"
    cookie_domain: str = "localhost"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    test_auth_enabled: bool = False
    test_auth_email: str = "playwright-e2e@example.com"
    test_auth_name: str = "Playwright Test"

    admin_api_key: str | None = None

    backfill_on_boot: bool = True
    backfill_days: int = 7
    tick_interval_seconds: int = 60
    generator_enabled: bool = True
    # Fraction of (metric, host) series to emit on each tick. Lower = sparser
    # data but faster generation. With ~1600 series in topology, 0.05 → ~80
    # rows/tick. At a 60s tick that's ~115k metric points/day.
    metric_sample_rate: float = 0.05
    # Multiplier applied to per-service log/trace base rates. Lower = quieter.
    log_rate_factor: float = 0.05
    trace_rate_factor: float = 0.05


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
