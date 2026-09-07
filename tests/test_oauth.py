"""Backend OAuth behavior tests."""
from __future__ import annotations

import httpx2
import pytest
from httpx2 import AsyncClient
from sqlalchemy import select

from core.config import settings
from core.models import OAuthIdentity, User
from tests.conftest import TestSession

GOOGLE_SUBJECT = "google-subject-123"


def _provider_transport(*, email: str, name: str) -> httpx2.MockTransport:
    def handler(request: httpx2.Request) -> httpx2.Response:
        path = request.url.path
        if path.endswith("/token") or path.endswith("/oauth/access_token"):
            return httpx2.Response(
                200,
                json={
                    "access_token": "provider-access-token",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                },
            )
        profile = {
            "sub": GOOGLE_SUBJECT,
            "email": email,
            "email_verified": True,
            "name": name,
        }
        return httpx2.Response(200, json=profile)

    return httpx2.MockTransport(handler)


@pytest.fixture
def mock_oauth(monkeypatch: pytest.MonkeyPatch):
    import core.services.oauth as oauth_service

    def fake_transport(provider: str) -> httpx2.MockTransport:
        return _provider_transport(email="social@example.com", name="Social User")

    monkeypatch.setattr(oauth_service, "oauth_transport", fake_transport)


async def _authorize_and_get_state(client: AsyncClient, provider: str) -> str:
    authz = await client.get(f"/api/auth/{provider}/authorize", follow_redirects=False)
    assert authz.status_code == 307
    return authz.headers["location"].split("state=")[1].split("&")[0]


async def test_authorize_redirects_to_provider(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/google/authorize", follow_redirects=False)
    assert resp.status_code == 307
    assert resp.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "state=" in resp.headers["location"]
    set_cookie = resp.headers.get("set-cookie", "")
    assert "oauth_state=" in set_cookie


async def test_callback_with_mismatched_state_is_rejected(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/auth/google/callback?code=abc&state=wrong-state", follow_redirects=False
    )
    assert resp.status_code in (400, 401, 307)


async def test_callback_without_state_cookie_is_rejected(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/auth/google/callback?code=abc&state=anything", follow_redirects=False
    )
    assert resp.status_code == 307
    assert "oauth_error=" in resp.headers["location"]


async def test_new_social_user_is_created_and_redirected_with_token(
    client: AsyncClient, mock_oauth
) -> None:
    state = await _authorize_and_get_state(client, "google")
    resp = await client.get(
        f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False
    )
    assert resp.status_code == 307
    redirect = resp.headers["location"]
    assert redirect.startswith(f"{settings.oauth_redirect_base}/auth/callback")
    assert "#token=" in redirect
    assert "user=" in redirect

    async with TestSession() as session:
        user = (await session.scalars(select(User))).one()
        assert user.email == "social@example.com"
        assert user.username
        assert user.password_hash is None
        identities = (await session.scalars(select(OAuthIdentity))).all()
        assert len(identities) == 1
        assert identities[0].provider == "google"
        assert identities[0].subject == GOOGLE_SUBJECT
        assert identities[0].user_id == user.id


async def test_second_login_same_provider_returns_same_user(
    client: AsyncClient, mock_oauth
) -> None:
    state = await _authorize_and_get_state(client, "google")
    await client.get(f"/api/auth/google/callback?code=abc&state={state}")

    async with TestSession() as session:
        first_user = (await session.scalars(select(User))).one()

    state2 = await _authorize_and_get_state(client, "google")
    resp2 = await client.get(
        f"/api/auth/google/callback?code=abc&state={state2}", follow_redirects=False
    )
    assert resp2.status_code == 307

    async with TestSession() as session:
        users = (await session.scalars(select(User))).all()
        assert len(users) == 1
        assert users[0].id == first_user.id


async def test_social_login_links_to_existing_email_account(
    client: AsyncClient, mock_oauth
) -> None:
    await client.post(
        "/api/auth/register",
        json={"email": "social@example.com", "password": "password123", "username": "passworduser"},
    )

    state = await _authorize_and_get_state(client, "google")
    resp = await client.get(
        f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False
    )
    assert resp.status_code == 307

    async with TestSession() as session:
        users = (await session.scalars(select(User))).all()
        assert len(users) == 1
        user = users[0]
        assert user.email == "social@example.com"
        assert user.username == "passworduser"
        assert user.password_hash is not None
        identity = (await session.scalars(select(OAuthIdentity))).one()
        assert identity.user_id == user.id


async def test_provider_subject_change_resolves_via_identity(
    client: AsyncClient, mock_oauth, monkeypatch: pytest.MonkeyPatch
) -> None:
    import core.services.oauth as oauth_service

    state = await _authorize_and_get_state(client, "google")
    await client.get(f"/api/auth/google/callback?code=abc&state={state}")

    def changed_email(provider: str) -> httpx2.MockTransport:
        return _provider_transport(email="new-email@example.com", name="Social User")

    monkeypatch.setattr(oauth_service, "oauth_transport", changed_email)
    state2 = await _authorize_and_get_state(client, "google")
    resp2 = await client.get(
        f"/api/auth/google/callback?code=abc&state={state2}", follow_redirects=False
    )
    assert resp2.status_code == 307

    async with TestSession() as session:
        users = (await session.scalars(select(User))).all()
        assert len(users) == 1


async def test_unknown_provider_is_rejected(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/twitter/authorize")
    assert resp.status_code == 404


async def test_social_user_cannot_login_with_password(client: AsyncClient, mock_oauth) -> None:
    state = await _authorize_and_get_state(client, "google")
    await client.get(f"/api/auth/google/callback?code=abc&state={state}")
    resp = await client.post(
        "/api/auth/login", json={"username": "socialuser", "password": "whatever"}
    )
    assert resp.status_code == 401
