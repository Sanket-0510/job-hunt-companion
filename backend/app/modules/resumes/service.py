import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.integrations.storage.base import get_storage
from app.modules.profiles.service import get_profile
from app.modules.resumes.models import Resume

PDF_MAGIC = b"%PDF-"


class ResumeNotFound(AppError):
    status_code = 404
    code = "resume_not_found"


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise AppError(
            f"That file is over {limit // (1024 * 1024)} MB.",
            code="file_too_large",
            status_code=413,
        )
    return data


async def upload_resume(db: AsyncSession, user_id: uuid.UUID, file: UploadFile) -> Resume:
    """Store the PDF privately and make it the active resume. The caller queues parsing."""
    data = await _read_limited(file, get_settings().resume_max_bytes)
    if not data.startswith(PDF_MAGIC):
        raise AppError("Please upload a PDF file.", code="not_a_pdf", status_code=415)

    resume_id = uuid.uuid4()
    path = f"{user_id}/{resume_id}.pdf"
    await get_storage().upload(path, data, "application/pdf")

    resume = Resume(
        id=resume_id,
        user_id=user_id,
        storage_path=path,
        original_filename=(file.filename or "resume.pdf")[:200],
        size_bytes=len(data),
    )
    db.add(resume)
    await db.flush()
    (await get_profile(db, user_id)).active_resume_id = resume_id
    await db.flush()
    await db.refresh(resume)
    return resume


async def get_resume(db: AsyncSession, user_id: uuid.UUID, resume_id: uuid.UUID) -> Resume:
    resume = await db.scalar(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    if resume is None:
        raise ResumeNotFound("Resume not found.")
    return resume
