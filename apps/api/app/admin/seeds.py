"""Canned fixture data for POST /admin/seed.

The first seeded user uses TEST_AUTH_EMAIL / TEST_AUTH_NAME so signing in
with the dev password (or via POST /auth/test-login) lands on this user.
"""
from typing import Any

from app.core.config import get_settings
from app.core.security import hash_password

BOB_EMAIL = "bob@grader.local"
SEED_USER_PASSWORD = "password123"


def build_seed_users() -> list[dict[str, Any]]:
    settings = get_settings()
    hashed = hash_password(SEED_USER_PASSWORD)
    return [
        {
            "email": settings.test_auth_email,
            "password_hash": hashed,
            "name": settings.test_auth_name,
            "picture": None,
        },
        {
            "email": BOB_EMAIL,
            "password_hash": hashed,
            "name": "Bob Grader",
            "picture": None,
        },
    ]
