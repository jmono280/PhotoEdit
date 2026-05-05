import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User | None:
        return await db.get(User, user_id)

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        email: str,
        hashed_password: str,
        full_name: str,
    ) -> User:
        user = User(email=email, hashed_password=hashed_password, full_name=full_name)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
