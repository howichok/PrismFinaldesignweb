/**
 * Launcher SSO E2E Tests (API-level)
 *
 * Tests the launcher login code generation and exchange flow.
 * Note: These tests don't require Microsoft OAuth - they test the code/token flow.
 */

import { test, expect } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

// Helper: Login and return user data
async function loginAs(request: any, username: string, email: string) {
    const response = await request.post(`${API_URL}/test/login`, {
        data: { username, email },
        headers: { "Origin": "http://localhost:3000" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
}

test.describe("Launcher SSO Flow", () => {
    test("generate login code with web session", async ({ request }) => {
        // Login via web session
        await loginAs(request, "e2e-launcher-user", "e2e-launcher-user@test.local");

        // Generate login code
        const codeResponse = await request.post(`${API_URL}/launcher/login-code`, {
            data: { deviceName: "E2E Test Device" },
            headers: { "Origin": "http://localhost:3000" },
        });

        // This will fail if user doesn't have Microsoft linked
        // But we can check the error is appropriate
        if (codeResponse.status() === 400 || codeResponse.status() === 403) {
            const error = await codeResponse.json();
            // Expected: requires Microsoft account linked
            expect(error.code).toMatch(/MICROSOFT_NOT_LINKED|NO_MINECRAFT|FORBIDDEN/);
        } else {
            // If it succeeds, verify code structure
            expect(codeResponse.ok()).toBeTruthy();
            const codeData = await codeResponse.json();
            expect(codeData.code).toBeDefined();
            expect(codeData.expiresAt).toBeDefined();
        }
    });

    test("exchange with invalid code returns error", async ({ request }) => {
        // Try to exchange an invalid code
        const exchangeResponse = await request.post(`${API_URL}/launcher/exchange`, {
            data: {
                code: "invalid-code-12345",
                deviceName: "E2E Test Device"
            },
            headers: { "Content-Type": "application/json" },
            // Note: No Origin header needed - launcher is exempt
        });

        // Should fail with 400 or 401
        expect([400, 401, 422]).toContain(exchangeResponse.status());
        const error = await exchangeResponse.json();
        expect(error.error || error.code).toBeDefined();
    });

    test("launcher/me without token returns 401", async ({ request }) => {
        const response = await request.get(`${API_URL}/launcher/me`);
        expect(response.status()).toBe(401);
    });

    test("launcher/me with invalid token returns 401", async ({ request }) => {
        const response = await request.get(`${API_URL}/launcher/me`, {
            headers: {
                "Authorization": "Bearer invalid-token-12345"
            }
        });
        expect(response.status()).toBe(401);
    });

    test("launcher sessions list requires web session", async ({ request }) => {
        // Without session
        const noAuthResponse = await request.get(`${API_URL}/launcher/sessions`);
        expect(noAuthResponse.status()).toBe(401);

        // With session
        await loginAs(request, "e2e-sessions-user", "e2e-sessions-user@test.local");

        const authResponse = await request.get(`${API_URL}/launcher/sessions`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(authResponse.ok()).toBeTruthy();
        const sessions = await authResponse.json();
        expect(sessions.sessions).toBeDefined();
        expect(Array.isArray(sessions.sessions)).toBe(true);
    });

    test("revoke-all launcher sessions", async ({ request }) => {
        await loginAs(request, "e2e-revoke-user", "e2e-revoke-user@test.local");

        const revokeResponse = await request.post(`${API_URL}/launcher/sessions/revoke-all`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(revokeResponse.ok()).toBeTruthy();

        const data = await revokeResponse.json();
        expect(data.ok).toBe(true);
        expect(data.revokedCount).toBeDefined();
    });
});

test.describe("Microsoft Account Status", () => {
    test("status endpoint returns link state", async ({ request }) => {
        await loginAs(request, "e2e-ms-status-user", "e2e-ms-status-user@test.local");

        const response = await request.get(`${API_URL}/auth/microsoft/status`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(response.ok()).toBeTruthy();

        const status = await response.json();
        expect(status.linked).toBeDefined();
        expect(typeof status.linked).toBe("boolean");
        // New test users won't have Microsoft linked
        expect(status.linked).toBe(false);
    });
});
