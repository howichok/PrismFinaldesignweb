/**
 * E2E Test Routes
 *
 * These routes are ONLY available when E2E_TEST_MODE=true.
 * They allow bypassing OAuth for automated testing.
 *
 * SECURITY: Never enable E2E_TEST_MODE in production!
 */

import { Router } from "express";
import { prisma } from "@prismmtr/db";
import crypto from "crypto";

const router = Router();

// ============================================
// Security Check - Double verify test mode
// ============================================
if (process.env.E2E_TEST_MODE !== "true") {
    // This should never be reached since we only load this module in test mode,
    // but add extra protection just in case
    router.use((_req, res) => {
        res.status(404).json({ error: "Not found" });
    });
}

// ============================================
// POST /test/login
// ============================================
// Creates a test session without OAuth
router.post("/login", async (req, res) => {
    try {
        const { username = "e2e-test-user", email = "e2e@test.local" } = req.body || {};

        // Find or create test user
        let user = await prisma.user.findFirst({
            where: { email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: crypto.randomUUID(),
                    discordId: `test-${Date.now()}`,
                    email,
                    username,
                    avatarUrl: null,
                    globalRole: "USER",
                    rolesVersion: 1
                }
            });
        }

        // Create auth session
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.authSession.create({
            data: {
                id: sessionId,
                userId: user.id,
                rolesVersionAtIssue: user.rolesVersion,
                createdAt: new Date(),
                lastSeenAt: new Date(),
                expiresAt,
                userAgent: "E2E Test Runner",
                ip: "127.0.0.1"
            }
        });

        const sameSiteRaw = (process.env.E2E_TEST_COOKIE_SAMESITE ?? "lax").toLowerCase();
        const sameSite =
            sameSiteRaw === "none" || sameSiteRaw === "strict" ? sameSiteRaw : "lax";
        const secure =
            process.env.E2E_TEST_COOKIE_SECURE === "true" ? true : false;
        const domain = process.env.E2E_TEST_COOKIE_DOMAIN || undefined;

        // Set session cookie
        res.cookie("prism_session", sessionId, {
            httpOnly: true,
            secure,
            sameSite: sameSite as "lax" | "strict" | "none",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: "/",
            ...(domain ? { domain } : {})
        });

        res.json({
            ok: true,
            userId: user.id,
            sessionId,
            username: user.username
        });
    } catch (error) {
        console.error("[TEST] Login error:", error);
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// ============================================
// POST /test/seed
// ============================================
// Seeds test data for E2E scenarios
router.post("/seed", async (req, res) => {
    try {
        const now = new Date();

        // Create test users
        const testUser = await prisma.user.upsert({
            where: { email: "e2e-user@test.local" },
            create: {
                id: crypto.randomUUID(),
                discordId: `test-user-${Date.now()}`,
                email: "e2e-user@test.local",
                username: "e2e-test-user",
                globalRole: "USER",
                rolesVersion: 1
            },
            update: {}
        });

        const testMod = await prisma.user.upsert({
            where: { email: "e2e-mod@test.local" },
            create: {
                id: crypto.randomUUID(),
                discordId: `test-mod-${Date.now()}`,
                email: "e2e-mod@test.local",
                username: "e2e-test-mod",
                globalRole: "MOD",
                rolesVersion: 1
            },
            update: { globalRole: "MOD" }
        });

        const testAdmin = await prisma.user.upsert({
            where: { email: "e2e-admin@test.local" },
            create: {
                id: crypto.randomUUID(),
                discordId: `test-admin-${Date.now()}`,
                email: "e2e-admin@test.local",
                username: "e2e-test-admin",
                globalRole: "ADMIN",
                rolesVersion: 1
            },
            update: { globalRole: "ADMIN" }
        });

        res.json({
            ok: true,
            seeded: {
                users: {
                    user: { id: testUser.id, username: testUser.username },
                    mod: { id: testMod.id, username: testMod.username },
                    admin: { id: testAdmin.id, username: testAdmin.username }
                }
            }
        });
    } catch (error) {
        console.error("[TEST] Seed error:", error);
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// ============================================
// POST /test/cleanup
// ============================================
// Cleans up test data
router.post("/cleanup", async (req, res) => {
    try {
        // Delete test sessions
        const deletedSessions = await prisma.authSession.deleteMany({
            where: {
                userAgent: "E2E Test Runner"
            }
        });

        // Delete test notifications
        const deletedNotifications = await prisma.notification.deleteMany({
            where: {
                user: {
                    email: { endsWith: "@test.local" }
                }
            }
        });

        // Delete test projects
        const deletedProjects = await prisma.project.deleteMany({
            where: {
                author: {
                    email: { endsWith: "@test.local" }
                }
            }
        });

        // Delete test posts
        const deletedPosts = await prisma.post.deleteMany({
            where: {
                author: {
                    email: { endsWith: "@test.local" }
                }
            }
        });

        res.json({
            ok: true,
            cleaned: {
                sessions: deletedSessions.count,
                notifications: deletedNotifications.count,
                projects: deletedProjects.count,
                posts: deletedPosts.count
            }
        });
    } catch (error) {
        console.error("[TEST] Cleanup error:", error);
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// ============================================
// POST /test/invalidate-user
// ============================================
// Bumps a user's rolesVersion to test session invalidation
router.post("/invalidate-user", async (req, res) => {
    try {
        const { userId } = req.body || {};

        if (!userId) {
            return res.status(400).json({ ok: false, error: "userId required" });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                rolesVersion: { increment: 1 }
            }
        });

        // Revoke all sessions
        await prisma.authSession.updateMany({
            where: { userId },
            data: { revokedAt: new Date() }
        });

        res.json({
            ok: true,
            userId: user.id,
            newRolesVersion: user.rolesVersion
        });
    } catch (error) {
        console.error("[TEST] Invalidate error:", error);
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

export default router;
