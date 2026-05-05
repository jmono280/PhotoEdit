import logging

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, user_repo: UserRepository) -> None:
        self.user_repo = user_repo

    async def register(
        self, db: AsyncSession, email: str, password: str, full_name: str
    ) -> User:
        existing = await self.user_repo.get_by_email(db, email)
        if existing:
            raise HTTPException(400, "Email ya registrado")
        hashed = hash_password(password)
        return await self.user_repo.create(db, email, hashed, full_name)

    async def login(self, db: AsyncSession, email: str, password: str) -> str:
        user = await self.user_repo.get_by_email(db, email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(401, "Credenciales incorrectas")
        if not user.is_active:
            raise HTTPException(403, "Usuario inactivo")
        return create_access_token({"sub": str(user.id)})
