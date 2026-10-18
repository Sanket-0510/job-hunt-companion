from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import NotAuthenticated
from app.modules.auth import service
from app.modules.auth.models import User

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def current_user(request: Request, db: DbSession) -> User:
    raw = request.cookies.get(get_settings().session_cookie_name)
    user = await service.user_from_session_token(db, raw) if raw else None
    if user is None:
        raise NotAuthenticated("Please log in.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
