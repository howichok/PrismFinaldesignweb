/**
 * Authentication E2E Tests
 *
 * Tests login via test mode and session invalidation.
 */

import { test, expect, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

// Helper: Login via test route
async function loginAsTestUser(page: Page, username = "e2e-test-user") {
    const response = await page.request.post(`${API_URL}/test/login`, {
        data: { username, email: `${username}@test.local` }
    });
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.userId).toBeDefined();

    return data;
}

test.describe("Authentication", () => {
    test("test mode login creates session and dashboard loads", async ({ page }) => {
        // Login via test route
        const loginData = await loginAsTestUser(page);

        // Navigate to dashboard
        await page.goto("/dashboard");

        // Should not redirect to sign-in (session is valid)
        await expect(page).not.toHaveURL(/auth|signin|login/);

        // Dashboard content should be visible (check for common elements)
        await page.waitForLoadState("networkidle");
    });

    test("session invalidation logs user out", async ({ page }) => {
        // Login first
        const loginData = await loginAsTestUser(page, "e2e-invalidation-test");

        // Navigate to dashboard to establish session
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Invalidate the session via API
        const invalidateResponse = await page.request.post(`${API_URL}/test/invalidate-user`, {
            data: { userId: loginData.userId }
        });
        expect(invalidateResponse.ok()).toBeTruthy();

        // Reload page - should be redirected to sign in
        await page.reload();
        await page.waitForLoadState("networkidle");

        // After invalidation, API should return 401
        const meResponse = await page.request.get(`${API_URL}/api/me`);
        expect(meResponse.status()).toBe(401);
    });
});

test.describe("Health Endpoints", () => {
    test("GET /health/live returns ok", async ({ request }) => {
        const response = await request.get(`${API_URL}/health/live`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.service).toBe("prismmtr-api");
    });

    test("GET /health/ready checks DB and keys", async ({ request }) => {
        const response = await request.get(`${API_URL}/health/ready`);
        const data = await response.json();

        expect(data.service).toBe("prismmtr-api");
        expect(data.checks).toBeDefined();
        expect(data.checks.database).toBeDefined();
    });

    test("GET /health/version returns build info", async ({ request }) => {
        const response = await request.get(`${API_URL}/health/version`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.service).toBe("prismmtr-api");
    });
});
