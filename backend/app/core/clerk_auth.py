"""
Verifies Clerk session tokens on incoming requests.

Clerk issues a short-lived RS256 JWT per session (the frontend attaches it
as `Authorization: Bearer <token>`). We verify it ourselves against Clerk's
published JWKS rather than calling Clerk's API on every request, so this
adds no extra network round-trip to the hot path once the keys are cached.

No Clerk secret key is needed for this -- JWKS verification only needs the
issuer's public keys, which are, well, public.
"""
import logging
import time

import httpx
import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient

from app.core.config import settings

logger = logging.getLogger("notebook_rag")

_jwk_client: PyJWKClient | None = None
_jwk_client_issuer: str | None = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client, _jwk_client_issuer
    if not settings.CLERK_ISSUER:
        raise HTTPException(
            500,
            "Server is missing CLERK_ISSUER -- set it to your Clerk app's Frontend API "
            "URL (Clerk Dashboard -> Configure -> API Keys) in the backend .env.",
        )
    if _jwk_client is None or _jwk_client_issuer != settings.CLERK_ISSUER:
        jwks_url = f"{settings.CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json"
        _jwk_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwk_client_issuer = settings.CLERK_ISSUER
    return _jwk_client


async def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: verifies the bearer token and returns the Clerk user id (`sub`)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()

    try:
        client = _get_jwk_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.CLERK_ISSUER,
            options={"require": ["exp", "iat", "sub"]},
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired, please sign in again")
    except (jwt.PyJWTError, httpx.HTTPError) as exc:
        logger.info("Rejected auth token: %s", exc)
        raise HTTPException(401, "Invalid session token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid session token")
    return user_id
