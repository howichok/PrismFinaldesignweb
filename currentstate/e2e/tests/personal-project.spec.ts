/**
 * Personal Project E2E Tests
 *
 * Tests create → submit → approve → verify flow.
 */

import { test, expect } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4000";

// Helper: Login and return user data
async function loginAsUser(request: any, username = "e2e-project-user") {
    const response = await request.post(`${API_URL}/test/login`, {
        data: { username, email: `${username}@test.local` },
        headers: { "Origin": "http://localhost:3000" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
}

async function loginAsMod(request: any) {
    const response = await request.post(`${API_URL}/test/login`, {
        data: { username: "e2e-test-mod", email: "e2e-mod@test.local" },
        headers: { "Origin": "http://localhost:3000" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
}

test.describe("Personal Project Flow", () => {
    test("create → submit → approve → verify public page", async ({ request }) => {
        // Step 1: Login as regular user
        const userData = await loginAsUser(request);

        // Step 2: Create a draft project
        const createResponse = await request.post(`${API_URL}/personal/projects`, {
            data: {
                title: "E2E Test Project",
                type: "resource-pack",
                description: "A project created by E2E tests"
            },
            headers: { "Origin": "http://localhost:3000" },
        });

        expect(createResponse.ok()).toBeTruthy();
        const project = await createResponse.json();
        expect(project.status).toBe("DRAFT");
        const projectId = project.id;

        // Step 3: Submit for moderation
        const submitResponse = await request.post(
            `${API_URL}/personal/projects/${projectId}/submit`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(submitResponse.ok()).toBeTruthy();
        const submittedProject = await submitResponse.json();
        expect(submittedProject.status).toBe("PENDING");

        // Step 4: Login as moderator and approve
        await loginAsMod(request);

        const approveResponse = await request.post(
            `${API_URL}/dashboard/mod/projects/${projectId}/approve`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(approveResponse.ok()).toBeTruthy();

        // Step 5: Verify public page is accessible
        const publicResponse = await request.get(`${API_URL}/public/projects/${projectId}`);
        expect(publicResponse.ok()).toBeTruthy();

        const publicProject = await publicResponse.json();
        expect(publicProject.status).toBe("PUBLISHED");
        expect(publicProject.title).toBe("E2E Test Project");

        // Cleanup: Delete the project
        await loginAsUser(request); // Re-login as original user
        // Note: Can't delete published projects, so they'll be cleaned up in teardown
    });

    test("create draft before moderation flow", async ({ request }) => {
        await loginAsUser(request, "e2e-draft-user");

        // Create a draft
        const createResponse = await request.post(`${API_URL}/personal/projects`, {
            data: {
                title: "E2E Draft Only Project",
                type: "mod",
                description: "This should stay as draft"
            },
            headers: { "Origin": "http://localhost:3000" },
        });

        expect(createResponse.ok()).toBeTruthy();
        const project = await createResponse.json();
        expect(project.status).toBe("DRAFT");

        // Verify it's in drafts list
        const draftsResponse = await request.get(
            `${API_URL}/dashboard/drafts?type=project`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(draftsResponse.ok()).toBeTruthy();
        const drafts = await draftsResponse.json();
        expect(drafts.items.some((d: any) => d.id === project.id)).toBe(true);

        // Delete draft
        const deleteResponse = await request.delete(
            `${API_URL}/personal/projects/${project.id}`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(deleteResponse.ok()).toBeTruthy();
    });
});
