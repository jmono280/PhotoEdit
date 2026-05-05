"""
Crea el usuario administrador inicial.

Uso:
    python -m app.scripts.seed_admin

Variables de entorno opcionales:
    ADMIN_EMAIL        (default: admin@photoedit.local)
    ADMIN_PASSWORD     (default: generado aleatoriamente)
    ADMIN_FULL_NAME    (default: Admin)
"""

import asyncio
import os
import secrets

from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.repositories.user_repo import UserRepository

_repo = UserRepository()


async def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@photoedit.local")
    password = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(16)
    full_name = os.environ.get("ADMIN_FULL_NAME", "Admin")

    async with AsyncSessionLocal() as db:
        existing = await _repo.get_by_email(db, email)
        if existing:
            print(f"Usuario '{email}' ya existe — nada que hacer.")
            return

        user = await _repo.create(db, email, hash_password(password), full_name)
        print(f"✓ Usuario creado")
        print(f"  Email:    {email}")
        print(f"  Password: {password}")
        print(f"  ID:       {user.id}")
        if not os.environ.get("ADMIN_PASSWORD"):
            print("  (contraseña generada aleatoriamente — guárdala ahora)")


if __name__ == "__main__":
    asyncio.run(main())
