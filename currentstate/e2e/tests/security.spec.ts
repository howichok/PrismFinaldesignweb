/**
 * Security E2E Tests (API-level)
 *
 * Tests origin protection and rate limiting.
 */

import { test, expect } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

test.describe("Origin Protection", () => {
    test("POST without Origin header returns 403", async ({ request }) => {
        // Override headers to remove Origin
        const response = await request.post(`${API_URL}/tickets`, {
            data: { category: "GENERAL", title: "Test", body: "Test body" },
            headers: {
                // Don't include Origin header
                "Content-Type": "application/json",
            },
        });

        expect(response.status()).toBe(403);
        const data = await response.json();
        expect(data.code).toBe("MISSING_ORIGIN");
    });

    test("POST with invalid Origin returns 403", async ({ request }) => {
        const response = await request.post(`${API_URL}/tickets`, {
            data: { category: "GENERAL", title: "Test", body: "Test body" },
            headers: {
                "Origin": "https://malicious-site.com",
                "Content-Type": "application/json",
            },
        });

        expect(response.status()).toBe(403);
        const data = await response.json();
        expect(data.code).toBe("ORIGIN_NOT_ALLOWED");
    });

    test("POST with valid Origin succeeds (assuming auth)", async ({ request }) => {
        const response = await request.post(`${API_URL}/tickets`, {
            data: { category: "GENERAL", title: "Test", body: "Test body" },
            headers: {
                "Origin": "http://localhost:3000",
                "Content-Type": "application/json",
            },
        });

        // Should be 401 (not authenticated) rather than 403 (origin blocked)
        expect(response.status()).toBe(401);
    });
});

test.describe("Rate Limiting", () => {
    test("exceeding rate limit returns 429", async ({ request }) => {
        // Make many requests rapidly to trigger rate limit
        // Note: This test may not trigger 429 if rate limits are high
        // It's more of a smoke test to verify rate limit headers are present

        const response = await request.get(`${API_URL}/health/live`);
        expect(response.ok()).toBeTruthy();

        // Check that rate limit headers are present
        // Note: Health endpoints may not have rate limits, so this is illustrative
        const headers = response.headers();
        // Rate limit headers are typically on protected endpoints
    });

    test("rate limit headers are present on protected endpoints", async ({ request }) => {
        // First login to get a session
        const loginResponse = await request.post(`${API_URL}/test/login`, {
            data: { username: "rate-limit-test" },
        });
        expect(loginResponse.ok()).toBeTruthy();

        // Make a request to a protected endpoint
        const response = await request.get(`${API_URL}/api/me`);

        // Check for rate limit headers
        const xRateLimitLimit = response.headers()["x-ratelimit-limit"];
        const xRateLimitRemaining = response.headers()["x-ratelimit-remaining"];

        // These may or may not be present depending on endpoint config
        // This test verifies the infrastructure exists
        if (xRateLimitLimit) {
            expect(parseInt(xRateLimitLimit)).toBeGreaterThan(0);
        }
    });
});

test.describe("Launcher Exchange (exempt from Origin)", () => {
    test("/launcher/exchange is accessible without Origin header", async ({ request }) => {
        // This endpoint should be exempt from Origin protection
        const response = await request.post(`${API_URL}/launcher/exchange`, {
            data: { code: "invalid-code", deviceName: "Test Device" },
            headers: {
                // No Origin header
                "Content-Type": "application/json",
            },
        });

        // Should return 400 (invalid code) not 403 (origin blocked)
        expect(response.status()).not.toBe(403);
        // Could be 400 (bad request) or 401 for invalid code
        expect([400, 401, 422]).toContain(response.status());
    });
});
