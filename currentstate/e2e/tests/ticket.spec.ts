/**
 * Ticket Flow E2E Tests
 *
 * Tests create ticket → mod reply → notification.
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

// Helper: Login as mod (ensure user has MOD role via seed)
async function loginAsMod(request: any) {
    // First seed users to ensure mod exists
    await request.post(`${API_URL}/test/seed`);

    return loginAs(request, "e2e-test-mod", "e2e-mod@test.local");
}

test.describe("Ticket Flow", () => {
    test("create ticket → mod reply → notification exists", async ({ request }) => {
        // Step 1: Seed test users (ensures mod exists)
        await request.post(`${API_URL}/test/seed`);

        // Step 2: Login as regular user and create ticket
        const userData = await loginAs(request, "e2e-ticket-user", "e2e-ticket-user@test.local");

        const createTicketResponse = await request.post(`${API_URL}/tickets`, {
            data: {
                category: "WEBSITE_BUG",
                title: "E2E Test Ticket",
                body: "This is a test ticket created by E2E tests."
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createTicketResponse.ok()).toBeTruthy();
        const ticket = await createTicketResponse.json();
        expect(ticket.id).toBeDefined();
        expect(ticket.status).toBe("OPEN");
        const ticketId = ticket.id;

        // Step 3: Login as mod
        await loginAsMod(request);

        // Step 4: Mod views ticket queue
        const queueResponse = await request.get(`${API_URL}/tickets/mod/queue?status=OPEN`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(queueResponse.ok()).toBeTruthy();
        const queue = await queueResponse.json();
        expect(queue.tickets.some((t: any) => t.id === ticketId)).toBe(true);

        // Step 5: Mod changes status to IN_PROGRESS
        const statusResponse = await request.patch(`${API_URL}/tickets/${ticketId}/status`, {
            data: { status: "IN_PROGRESS" },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(statusResponse.ok()).toBeTruthy();

        // Step 6: Mod replies to ticket
        const replyResponse = await request.post(`${API_URL}/tickets/${ticketId}/messages`, {
            data: { body: "Thanks for reporting! We are looking into this." },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(replyResponse.ok()).toBeTruthy();

        // Step 7: Login as original user and check notifications
        await loginAs(request, "e2e-ticket-user", "e2e-ticket-user@test.local");

        const notificationsResponse = await request.get(`${API_URL}/notifications`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(notificationsResponse.ok()).toBeTruthy();

        const notifications = await notificationsResponse.json();
        // Should have notification about ticket status change or new message
        expect(notifications.items.length).toBeGreaterThan(0);

        // Verify at least one notification is ticket-related
        const ticketNotification = notifications.items.find(
            (n: any) => n.type.includes("TICKET") || n.linkUrl?.includes("ticket")
        );
        expect(ticketNotification).toBeDefined();
    });

    test("user can close their own ticket", async ({ request }) => {
        // Login as user
        const userData = await loginAs(request, "e2e-close-ticket-user", "e2e-close-ticket@test.local");

        // Create ticket
        const createResponse = await request.post(`${API_URL}/tickets`, {
            data: {
                category: "GENERAL",
                title: "E2E Closeable Ticket",
                body: "This ticket will be closed by the user."
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createResponse.ok()).toBeTruthy();
        const ticket = await createResponse.json();

        // Close ticket
        const closeResponse = await request.post(`${API_URL}/tickets/${ticket.id}/close`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(closeResponse.ok()).toBeTruthy();

        // Verify ticket is closed
        const getResponse = await request.get(`${API_URL}/tickets/${ticket.id}`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(getResponse.ok()).toBeTruthy();
        const closedTicket = await getResponse.json();
        expect(closedTicket.status).toBe("CLOSED");
    });

    test("mod can assign ticket to themselves", async ({ request }) => {
        // Seed to ensure mod exists
        const seedResponse = await request.post(`${API_URL}/test/seed`);
        const seedData = await seedResponse.json();
        const modId = seedData.seeded.users.mod.id;

        // Create ticket as user
        await loginAs(request, "e2e-assign-user", "e2e-assign-user@test.local");

        const createResponse = await request.post(`${API_URL}/tickets`, {
            data: {
                category: "ACCOUNT",
                title: "E2E Assignable Ticket",
                body: "This ticket will be assigned to a mod."
            },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(createResponse.ok()).toBeTruthy();
        const ticket = await createResponse.json();

        // Login as mod and assign
        await loginAsMod(request);

        const assignResponse = await request.patch(`${API_URL}/tickets/${ticket.id}/assign`, {
            data: { assignedToId: modId },
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(assignResponse.ok()).toBeTruthy();

        // Verify assignment
        const getResponse = await request.get(`${API_URL}/tickets/${ticket.id}`, {
            headers: { "Origin": "http://localhost:3000" },
        });
        expect(getResponse.ok()).toBeTruthy();
        const assignedTicket = await getResponse.json();
        expect(assignedTicket.assignedToId).toBe(modId);
    });
});
