# =============================================================================
# CloudMind AI – tests/test_auth.py
#
# Authentication test suite — 8 tests covering:
#   ✅ Registration (success, duplicate username, duplicate email, weak password)
#   ✅ Login (success, wrong password, unknown user)
#   ✅ /auth/me profile endpoint
# =============================================================================

import random
import pytest


class TestRegistration:
    def test_register_new_user_returns_201(self, client):
        """Fresh unique user — should return 201 Created."""
        r = random.randint(100000, 999999)
        payload = {
            "username": f"new_{r}",
            "email"   : f"new_{r}@test.io",
            "password": "SecureP@ss1A",
        }
        resp = client.post("/auth/register", json=payload)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["username"] == payload["username"]
        assert body["role"]     == "user"
        assert "hashed_pw" not in body, "hashed_pw must never be exposed"

    def test_register_duplicate_username_returns_400(self, client, test_user):
        """Second registration with same username must return 400."""
        client.post("/auth/register", json=test_user)
        resp = client.post("/auth/register", json=test_user)
        assert resp.status_code == 400
        assert "already" in resp.json()["detail"].lower()

    def test_register_duplicate_email_returns_400(self, client, test_user):
        """Different username but same email must also return 400."""
        client.post("/auth/register", json=test_user)
        dup_email = {
            "username": f"other_{random.randint(1,99999)}",
            "email"   : test_user["email"],
            "password": "SecureP@ss1A",
        }
        resp = client.post("/auth/register", json=dup_email)
        assert resp.status_code == 400

    def test_register_weak_password_returns_422(self, client):
        """Password without special char / digit must return 422."""
        resp = client.post("/auth/register", json={
            "username": f"weakuser_{random.randint(1,9999)}",
            "email"   : f"weak_{random.randint(1,9999)}@x.com",
            "password": "simplepassword",
        })
        assert resp.status_code == 422

    def test_register_invalid_email_returns_422(self, client):
        """Malformed email must return 422."""
        resp = client.post("/auth/register", json={
            "username": f"badmail_{random.randint(1,9999)}",
            "email"   : "not-an-email",
            "password": "SecureP@ss1A",
        })
        assert resp.status_code == 422


class TestLogin:
    def test_login_valid_credentials_returns_token(self, client, test_user):
        """Valid credentials must return a JWT access token."""
        client.post("/auth/register", json=test_user)
        resp = client.post("/auth/login", json={
            "username": test_user["username"],
            "password": test_user["password"],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert "expires_in" in body

    def test_login_wrong_password_returns_401(self, client, test_user):
        """Wrong password must return 401."""
        resp = client.post("/auth/login", json={
            "username": test_user["username"],
            "password": "WrongPass!111",
        })
        assert resp.status_code == 401

    def test_login_unknown_user_returns_401(self, client):
        """Non-existent username must return 401."""
        resp = client.post("/auth/login", json={
            "username": "nobody_ghost_xyz",
            "password": "IrrelevantP@ss1",
        })
        assert resp.status_code == 401


class TestProfile:
    def test_me_returns_user_profile(self, client, auth_headers, test_user):
        """/auth/me must return the authenticated user's profile."""
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == test_user["username"]
        assert "hashed_pw" not in body
        assert "role" in body

    def test_me_without_token_returns_401(self, client):
        """/auth/me without token must return 401."""
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        """/auth/me with bogus token must return 401."""
        resp = client.get("/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert resp.status_code == 401
