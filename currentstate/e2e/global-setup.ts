/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to seed test data.
 */

import { request } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

async function globalSetup() {
    console.log("[E2E Setup] Starting global setup...");

    const context = await request.newContext({
        baseURL: API_URL,
    });

    try {
        // Seed test data
        const seedResponse = await context.post("/test/seed");
        if (seedResponse.ok()) {
            const data = await seedResponse.json();
            console.log("[E2E Setup] Test data seeded:", data.seeded);
        } else {
            console.error("[E2E Setup] Failed to seed test data:", await seedResponse.text());
        }
    } catch (error) {
        console.error("[E2E Setup] Error during setup:", error);
        // Don't throw - tests may still work if data already exists
    }

    await context.dispose();
    console.log("[E2E Setup] Global setup complete");
}

export default globalSetup;
