from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.modules.admin.service import collect_stats
from app.modules.auth.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/admin", tags=["admin"])

NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}


@router.get("/stats")
async def stats(user: CurrentUser, db: DbSession):
    """Counts for the admin page. Anyone not on ADMIN_EMAILS gets a plain 404."""
    if user.email.lower() not in get_settings().admin_email_set:
        return JSONResponse(NOT_FOUND, status_code=404)
    return await collect_stats(db)
