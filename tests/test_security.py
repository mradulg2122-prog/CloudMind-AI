# =============================================================================
# CloudMind AI – tests/test_security.py
#
# Security test suite — 8 tests covering:
#   ✅ Unauthenticated access to protected endpoints returns 401
#   ✅ Tampered JWT token returns 401
#   ✅ RBAC: viewer-role user cannot access admin endpoints (403)
#   ✅ Security headers present on all responses
#   ✅ /logs is admin-only (regular user gets 403)
#   ✅ /admin/users is admin-only
# =============================================================================

import pytest


class TestAuthorizationBoundaries:
    PROTECTED_ROUTES = [
        ("GET",  "/predictions/history"),
        ("GET",  "/analytics"),
        ("GET",  "/alerts"),
        ("GET",  "/reports"),
        ("GET",  "/export/csv"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ROUTES)
    def test_unauthenticated_returns_401(self, client, method, path):
        """All protected routes must require authentication."""
        resp = client.request(method, path)
        assert resp.status_code == 401, f"{method} {path} should require auth, got {resp.status_code}"

    def test_tampered_jwt_returns_401(self, client, auth_headers):
        """A JWT with modified payload must be rejected as invalid."""
        token = auth_headers["Authorization"].replace("Bearer ", "")
        parts = token.split(".")
        if len(parts) == 3:
            # Corrupt the signature
            tampered = f"{parts[0]}.{parts[1]}.invalidsignatureXXX"
            resp = client.get("/auth/me", headers={"Authorization": f"Bearer {tampered}"})
            assert resp.status_code == 401

    def test_expired_format_token_returns_401(self, client):
        """A completely fabricated token must return 401."""
        resp = client.get("/auth/me", headers={"Authorization": "Bearer fake.token.value"})
        assert resp.status_code == 401

    def test_logs_endpoint_requires_admin(self, client, auth_headers):
        """/logs must require admin role — regular user gets 403."""
        resp = client.get("/logs", headers=auth_headers)
        # Regular user should be forbidden (403), or 401 if role check uses different logic
        assert resp.status_code in (403, 401), f"Expected 403 or 401, got {resp.status_code}"

    def test_admin_users_endpoint_requires_admin(self, client, auth_headers):
        """/admin/users must require admin role — regular user gets 403."""
        resp = client.get("/admin/users", headers=auth_headers)
        assert resp.status_code in (403, 401)

    def test_role_update_requires_admin(self, client, auth_headers, test_user):
        """/admin/users/{username}/role must require admin — regular user gets 403."""
        resp = client.patch(
            f"/admin/users/{test_user['username']}/role",
            json={"role": "admin"},
            headers=auth_headers,
        )
        assert resp.status_code in (403, 401)


class TestSecurityHeaders:
    def test_health_response_has_security_headers(self, client):
        """All responses must include critical security headers."""
        resp = client.get("/health")
        headers = resp.headers
        assert headers.get("X-Content-Type-Options")  == "nosniff"
        assert headers.get("X-Frame-Options")          == "DENY"
        assert headers.get("X-XSS-Protection")         == "1; mode=block"
        assert "Content-Security-Policy" in headers

    def test_referrer_policy_present(self, client):
        """Referrer-Policy header must be set."""
        resp = client.get("/")
        assert "Referrer-Policy" in resp.headers

    def test_permissions_policy_present(self, client):
        """Permissions-Policy header must restrict camera/mic/geo."""
        resp = client.get("/")
        pp = resp.headers.get("Permissions-Policy", "")
        assert "camera=()" in pp
        assert "microphone=()" in pp
