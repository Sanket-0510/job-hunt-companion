from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Domain error raised by services; rendered as {"error": {"code", "message"}}."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotAuthenticated(AppError):
    status_code = 401
    code = "not_authenticated"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class ServiceUnavailable(AppError):
    status_code = 503
    code = "service_unavailable"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        retry_after = getattr(exc, "retry_after", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
            headers={"Retry-After": str(retry_after)} if retry_after else None,
        )
