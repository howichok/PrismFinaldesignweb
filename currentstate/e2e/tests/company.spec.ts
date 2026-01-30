/**
 * Company Flow E2E Tests
 *
 * Tests create company → invite → accept → create project → approve → notification.
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

test.describe("Company Flow", () => {
    test("create company → invite → accept → create project → approve", async ({ request }) => {
        // Step 1: Login as owner and create company
        const ownerData = await loginAs(request, "e2e-company-owner", "e2e-company-owner@test.local");

        const createCompanyResponse = await request.post(`${API_URL}/companies`, {
            data: {
                name: "E2E Test Company",
                slug: `e2e-company-${Date.now()}`,
                description: "A company created by E2E tests"
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createCompanyResponse.ok()).toBeTruthy();
        const company = await createCompanyResponse.json();
        expect(company.name).toBe("E2E Test Company");
        const companyId = company.id;

        // Step 2: Create a second user to invite
        const memberData = await loginAs(request, "e2e-company-member", "e2e-company-member@test.local");
        const memberId = memberData.userId;

        // Step 3: Login back as owner and send invite
        await loginAs(request, "e2e-company-owner", "e2e-company-owner@test.local");

        const inviteResponse = await request.post(`${API_URL}/company/${companyId}/hub/invites`, {
            data: { userId: memberId, role: "MEMBER" },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(inviteResponse.ok()).toBeTruthy();
        const invite = await inviteResponse.json();
        const inviteId = invite.id;

        // Step 4: Login as member and accept invite
        await loginAs(request, "e2e-company-member", "e2e-company-member@test.local");

        const acceptResponse = await request.post(`${API_URL}/dashboard/invites/${inviteId}/accept`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(acceptResponse.ok()).toBeTruthy();

        // Step 5: Create a company project as member
        const createProjectResponse = await request.post(`${API_URL}/company/${companyId}/hub/projects`, {
            data: {
                title: "E2E Company Project",
                type: "resource-pack",
                description: "A project in the company"
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createProjectResponse.ok()).toBeTruthy();
        const project = await createProjectResponse.json();
        expect(project.status).toBe("DRAFT");
        const projectId = project.id;

        // Step 6: Submit project for review
        const submitResponse = await request.post(
            `${API_URL}/company/${companyId}/hub/projects/${projectId}/submit`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(submitResponse.ok()).toBeTruthy();

        // Step 7: Login as owner and approve
        await loginAs(request, "e2e-company-owner", "e2e-company-owner@test.local");

        const approveResponse = await request.post(
            `${API_URL}/company/${companyId}/hub/moderation/projects/${projectId}/approve`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(approveResponse.ok()).toBeTruthy();

        // Step 8: Login as member and check for notifications
        await loginAs(request, "e2e-company-member", "e2e-company-member@test.local");

        const notificationsResponse = await request.get(`${API_URL}/notifications`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(notificationsResponse.ok()).toBeTruthy();

        const notifications = await notificationsResponse.json();
        // Should have notifications (invite accepted, project approved, etc.)
        expect(notifications.items).toBeDefined();
    });

    test("join request flow", async ({ request }) => {
        // Create a company with a unique slug
        const ownerData = await loginAs(request, "e2e-joinreq-owner", "e2e-joinreq-owner@test.local");

        const createCompanyResponse = await request.post(`${API_URL}/companies`, {
            data: {
                name: "E2E Join Request Company",
                slug: `e2e-joinreq-${Date.now()}`,
                description: "Company for join request test"
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createCompanyResponse.ok()).toBeTruthy();
        const company = await createCompanyResponse.json();
        const companyId = company.id;

        // Login as a different user and request to join
        await loginAs(request, "e2e-joinreq-user", "e2e-joinreq-user@test.local");

        const joinResponse = await request.post(`${API_URL}/company/${companyId}/join-requests`, {
            data: { message: "Please let me join!" },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(joinResponse.ok()).toBeTruthy();
        const joinRequest = await joinResponse.json();

        // Login as owner and approve
        await loginAs(request, "e2e-joinreq-owner", "e2e-joinreq-owner@test.local");

        const approveResponse = await request.post(
            `${API_URL}/company/${companyId}/hub/join-requests/${joinRequest.id}/approve`,
            { headers: { "Origin": "http://localhost:3000" } }
        );
        expect(approveResponse.ok()).toBeTruthy();

        // Verify user is now a member
        const membersResponse = await request.get(`${API_URL}/company/${companyId}/hub/members`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(membersResponse.ok()).toBeTruthy();
        const members = await membersResponse.json();
        expect(members.members.length).toBeGreaterThanOrEqual(2); // Owner + new member
    });
});
