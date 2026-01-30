/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to clean up test data.
 */

import { request } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

async function globalTeardown() {
    console.log("[E2E Teardown] Starting cleanup...");

    const context = await request.newContext({
        baseURL: API_URL,
    });

    try {
        const cleanupResponse = await context.post("/test/cleanup");
        if (cleanupResponse.ok()) {
            const data = await cleanupResponse.json();
            console.log("[E2E Teardown] Cleaned up:", data.cleaned);
        } else {
            console.error("[E2E Teardown] Failed to cleanup:", await cleanupResponse.text());
        }
    } catch (error) {
        console.error("[E2E Teardown] Error during cleanup:", error);
    }

    await context.dispose();
    console.log("[E2E Teardown] Cleanup complete");
}

export default globalTeardown;
