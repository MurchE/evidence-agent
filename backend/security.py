"""Security helpers shared by the FastAPI apps."""

from __future__ import annotations

import os
import secrets
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response


DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)
DEFAULT_MAX_BODY_BYTES = 32_768

def cors_allowlist() -> list[str]:
    """Return configured CORS origins without allowing wildcard production access."""
    configured = os.getenv("CORS_ALLOW_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    if not origins:
        return list(DEFAULT_ALLOWED_ORIGINS)
    return [origin for origin in origins if origin != "*"]


def max_body_bytes() -> int:
    raw = os.getenv("MAX_REQUEST_BODY_BYTES", str(DEFAULT_MAX_BODY_BYTES))
    try:
        return max(1024, int(raw))
    except ValueError:
        return DEFAULT_MAX_BODY_BYTES


async def reject_oversized_body(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            size = 0
        if size > max_body_bytes():
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large"},
            )

    return await call_next(request)


def _extract_token(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    api_key = request.headers.get("x-api-key", "")
    if api_key:
        return api_key.strip()

    query_token = request.query_params.get("token", "")
    if query_token:
        return query_token.strip()

    return ""


async def require_paid_auth(request: Request) -> None:
    """Require a configured API token before routes that can spend upstream keys."""
    expected = os.getenv("EVIDENCE_AGENT_API_TOKEN", "")
    supplied = _extract_token(request)
    if not expected or not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Authentication required")
