from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.seeds import build_seed_users
from app.auth.models import User

CLEARED_TABLES: list[str] = [
    "users",
]


async def truncate_all(db: AsyncSession) -> list[str]:
    table_list = ", ".join(CLEARED_TABLES)
    await db.execute(text(f"TRUNCATE {table_list} RESTART IDENTITY CASCADE"))
    await db.commit()
    return list(CLEARED_TABLES)


async def seed_all(db: AsyncSession, *, reset: bool) -> dict[str, int]:
    if reset:
        await truncate_all(db)

    user_records = build_seed_users()
    users = [User(**rec) for rec in user_records]
    for u in users:
        db.add(u)
    await db.commit()

    return {
        "users": len(users),
    }
