import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, UploadFile, status

from app.modules.auth.dependencies import CurrentUser, DbSession
from app.modules.resumes import service
from app.modules.resumes.models import ParseStatus, Resume
from app.modules.resumes.schemas import ResumeOut
from app.modules.resumes.tasks import parse_resume

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.post("", response_model=ResumeOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_resume(file: UploadFile, user: CurrentUser, db: DbSession) -> Resume:
    """Upload a PDF; parsing runs in the worker. Poll GET /resumes/{id} for the result."""
    resume = await service.upload_resume(db, user.id, file)
    await db.commit()
    try:
        await parse_resume.defer_async(resume_id=str(resume.id))
    except Exception:
        # The upload itself succeeded; the user just fills the form by hand.
        logger.exception("could not queue parse for resume %s", resume.id)
        resume.parse_status = ParseStatus.failed
        resume.parse_error = "parser_unavailable"
        resume.parsed_at = datetime.now(UTC)
        await db.commit()
    return resume


@router.get("/{resume_id}", response_model=ResumeOut)
async def get_resume(resume_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Resume:
    return await service.get_resume(db, user.id, resume_id)
