import { defineConfig, devices } from "@playwright/test";

/**
 * PrismMTR E2E Test Configuration
 *
 * Run tests with: pnpm e2e
 */
export default defineConfig({
    testDir: "./e2e/tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",

    use: {
        baseURL: process.env.E2E_WEB_URL || "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    // Web server configuration - starts API and Web for tests
    webServer: [
        {
            command: "pnpm --filter @prismmtr/api dev",
            url: "http://localhost:4000/health/live",
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
            env: {
                E2E_TEST_MODE: "true",
            },
        },
        {
            command: "pnpm --filter @prismmtr/web dev",
            url: "http://localhost:3000",
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
        },
    ],

    // Global setup/teardown
    globalSetup: "./e2e/global-setup.ts",
    globalTeardown: "./e2e/global-teardown.ts",
});
