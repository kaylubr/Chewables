from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import urlencode

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.models import OAuthIdentity, User
from core.security import create_access_token

PROVIDERS = ("google",)

STATE_COOKIE_NAME = "oauth_state"
STATE_MAX_AGE_SECONDS = 10 * 60  # 10 minutes
_STATE_VERSION = 1

PROVIDER_CONFIGS: dict[str, dict] = {
    "google": {
        "client_id": "google_client_id",
        "client_secret": "google_client_secret",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "profile_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
    },
}


class OAuthError(Exception):
    """Provider exchange or state validation failure."""


class UnknownProviderError(Exception):
    pass


class TransportFactory(Protocol):
    def __call__(self, provider: str) -> httpx.AsyncBaseTransport: ...


class OAuthProfile:
    provider: str
    subject: str
    email: str
    name: str


def _config_for(provider: str) -> dict:
    try:
        return PROVIDER_CONFIGS[provider]
    except KeyError:
        raise UnknownProviderError(f"Unsupported OAuth provider: {provider}") from None


def _client_id(provider: str) -> str:
    return getattr(settings, _config_for(provider)["client_id"])


def _client_secret(provider: str) -> str:
    return getattr(settings, _config_for(provider)["client_secret"])


def oauth_transport(provider: str) -> httpx.AsyncBaseTransport:
    """Real transport; tests monkeypatch this to inject a MockTransport."""
    return httpx.AsyncClient()._transport  # type: ignore[attr-defined]


def _new_oauth_client(provider: str) -> AsyncOAuth2Client:
    cfg = _config_for(provider)
    return AsyncOAuth2Client(
        client_id=_client_id(provider),
        client_secret=_client_secret(provider),
        scope=cfg["scope"],
        transport=oauth_transport(provider),
    )


def _sign_state(raw: str) -> str:
    digest = hmac.new(
        settings.auth_secret.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()
    return f"{raw}.{digest}"


def _verify_state(raw_signed: str) -> str | None:
    raw, _, sig = raw_signed.rpartition(".")
    if not raw or not sig:
        return None
    expected = hmac.new(
        settings.auth_secret.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    return raw


def new_state_token(*, next_path: str | None = None) -> str:
    """Create a signed state token embedding an optional validated next path."""
    raw = json.dumps(
        {
            "v": _STATE_VERSION,
            "nonce": secrets.token_urlsafe(32),
            "next": validate_next_path(next_path),
            "iat": datetime.now(timezone.utc).timestamp(),
        },
        separators=(",", ":"),
    )
    b64 = base64.urlsafe_b64encode(raw.encode()).decode()
    return _sign_state(b64)


def _unpack_state(state: str) -> dict | None:
    raw = _verify_state(state)
    if raw is None:
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(raw.encode()))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("v") != _STATE_VERSION:
        return None
    issued = payload.get("iat")
    if not isinstance(issued, (int, float)):
        return None
    if datetime.now(timezone.utc).timestamp() - issued > STATE_MAX_AGE_SECONDS:
        return None
    return payload


def is_valid_state(state: str) -> bool:
    """True if the state is one we signed, current version, and unexpired."""
    return _unpack_state(state) is not None


def next_from_state(state: str) -> str | None:
    payload = _unpack_state(state)
    if payload is None:
        return None
    return validate_next_path(payload.get("next"))


def validate_next_path(next_path: object) -> str | None:
    """Allow only same-origin absolute paths: one '/', no scheme, no '//'."""
    if not isinstance(next_path, str) or not next_path:
        return None
    if not next_path.startswith("/") or next_path.startswith("//"):
        return None
    return next_path


def authorize_url(provider: str, state: str) -> str:
    cfg = _config_for(provider)
    params = urlencode(
        {
            "client_id": _client_id(provider),
            "redirect_uri": callback_url(provider),
            "response_type": "code",
            "scope": cfg["scope"],
            "state": state,
        }
    )
    return f"{cfg['authorize_url']}?{params}"


def callback_url(provider: str) -> str:
    """Backend route the provider redirects to after consent."""
    return f"{settings.backend_base_url}/api/auth/{provider}/callback"


async def _fetch_profile(
    client: AsyncOAuth2Client, provider: str, code: str
) -> OAuthProfile:
    cfg = _config_for(provider)
    try:
        token = await client.fetch_token(
            url=cfg["token_url"],
            grant_type="authorization_code",
            code=code,
            redirect_uri=callback_url(provider),
        )
    except Exception as exc:  # authlib raises on non-2xx / network errors
        raise OAuthError("token exchange failed") from exc

    access_token = token.get("access_token")
    if not access_token:
        raise OAuthError("token exchange returned no access token")

    resp = await client.get(cfg["profile_url"], params={"access_token": access_token})
    if resp.status_code != 200:
        raise OAuthError("profile fetch failed")
    data = resp.json()

    subject = str(data.get("sub") or "")
    if not subject:
        raise OAuthError("provider returned no subject")

    profile = OAuthProfile()
    profile.provider = provider
    profile.subject = subject
    profile.email = str(data.get("email") or "").lower()
    profile.name = str(data.get("name") or "")
    return profile


async def _user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(User.email == email))


async def _identity_by_provider_subject(
    session: AsyncSession, provider: str, subject: str
) -> OAuthIdentity | None:
    return await session.scalar(
        select(OAuthIdentity).where(
            OAuthIdentity.provider == provider,
            OAuthIdentity.subject == subject,
        )
    )


def _slugify(name: str) -> str:
    slug = "".join(c for c in name.lower() if c.isalnum() or c == "_")
    slug = slug.strip("_")[:32]
    return slug if len(slug) >= 3 else "user"


async def _generate_username(session: AsyncSession, base: str) -> str:
    """Return an unused username derived from base (base, base2, base3, ...)."""
    taken = set((await session.scalars(select(User.username))).all())
    candidate = base[:32]
    suffix = 2
    while candidate in taken:
        suffix_str = str(suffix)
        candidate = f"{base[: 32 - len(suffix_str)]}{suffix_str}"
        suffix += 1
    return candidate


async def resolve_social_user(
    session: AsyncSession, profile: OAuthProfile
) -> User:
    """Resolve the user for a provider profile (ADR 0008 resolution order)."""
    # 1. Existing identity -> log that user in.
    identity = await _identity_by_provider_subject(
        session, profile.provider, profile.subject
    )
    if identity is not None:
        user = await session.get(User, identity.user_id)
        if user is not None:
            return user

    # 2. Verified email matches an existing account -> link a new identity.
    if profile.email:
        existing = await _user_by_email(session, profile.email)
        if existing is not None:
            session.add(
                OAuthIdentity(
                    user_id=existing.id,
                    provider=profile.provider,
                    subject=profile.subject,
                )
            )
            await session.commit()
            return existing

    # 3. New account: auto-generate username, no password hash.
    username = await _generate_username(session, _slugify(profile.name))
    user = User(username=username, email=profile.email, password_hash=None)
    session.add(user)
    await session.flush()
    session.add(
        OAuthIdentity(
            user_id=user.id,
            provider=profile.provider,
            subject=profile.subject,
        )
    )
    await session.commit()
    await session.refresh(user)
    return user


async def login_with_oauth_code(
    session: AsyncSession, provider: str, code: str
) -> User:
    """Exchange a provider code for a profile, then resolve/create the user."""
    client = _new_oauth_client(provider)
    try:
        profile = await _fetch_profile(client, provider, code)
    finally:
        await client.aclose()
    return await resolve_social_user(session, profile)


def error_redirect(error: str) -> str:
    return f"{settings.oauth_redirect_base}/login?oauth_error={error}"


def success_redirect(user: User, next_path: str | None) -> str:
    """Fragment redirect: token + user never touch server logs or history."""
    fragment = urlencode(
        {
            "token": create_access_token(user.id),
            "user": json.dumps(
                {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                },
                separators=(",", ":"),
            ),
        }
    )
    target = validate_next_path(next_path) or "/photos"
    return f"{settings.oauth_redirect_base}/auth/callback?next={target}#{fragment}"
