/**
 * Public User Profile Routes
 *
 * Provides public profile information and content listings.
 * No authentication required for viewing public profiles.
 */

import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { z } from "zod";

const router = Router();

// ============================================
// Query Schemas
// ============================================

const PaginationQuery = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(50).default(20)
});

// ============================================
// Helper: Serialize User Mini
// ============================================

function serializeUserMini(user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    globalRole: string;
}) {
    return {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole
    };
}

// ============================================
// GET /users/:id/public
// ============================================
// Get public profile and stats for a user
router.get("/:id/public", async (req, res) => {
    const { id } = req.params;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                globalRole: true,
                isBanned: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
                code: "USER_NOT_FOUND"
            });
        }

        // Get counts for published content only
        const [publishedProjects, publishedPosts, companies] = await Promise.all([
            prisma.project.count({
                where: {
                    authorId: id,
                    status: "PUBLISHED",
                    ownership: "PERSONAL"
                }
            }),
            prisma.post.count({
                where: {
                    authorId: id,
                    status: "PUBLISHED",
                    ownership: "PERSONAL"
                }
            }),
            prisma.companyMember.count({
                where: { userId: id }
            })
        ]);

        res.json({
            user: serializeUserMini(user),
            isBanned: user.isBanned,
            stats: {
                publishedProjects,
                publishedPosts,
                companies
            },
            createdAt: user.createdAt.toISOString()
        });
    } catch (err) {
        console.error("Failed to get user profile:", err);
        res.status(500).json({ error: "Failed to get user profile" });
    }
});

// ============================================
// GET /users/:id/projects
// ============================================
// Get paginated published projects for a user
router.get("/:id/projects", async (req, res) => {
    const { id } = req.params;

    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(422).json({
            error: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten()
        });
    }

    const { cursor, limit } = parsed.data;

    try {
        // Check user exists
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, isBanned: true }
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
                code: "USER_NOT_FOUND"
            });
        }

        // Don't show content for banned users
        if (user.isBanned) {
            return res.json({
                items: [],
                nextCursor: null
            });
        }

        const projects = await prisma.project.findMany({
            where: {
                authorId: id,
                status: "PUBLISHED",
                ownership: "PERSONAL"
            },
            select: {
                id: true,
                title: true,
                description: true,
                type: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        globalRole: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        });

        const hasMore = projects.length > limit;
        const items = hasMore ? projects.slice(0, -1) : projects;
        const nextCursor = hasMore ? items[items.length - 1]?.id : null;

        res.json({
            items: items.map((p) => ({
                id: p.id,
                title: p.title,
                description: p.description,
                type: p.type,
                status: p.status,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                author: p.author ? serializeUserMini(p.author) : undefined
            })),
            nextCursor
        });
    } catch (err) {
        console.error("Failed to get user projects:", err);
        res.status(500).json({ error: "Failed to get user projects" });
    }
});

// ============================================
// GET /users/:id/posts
// ============================================
// Get paginated published posts for a user
router.get("/:id/posts", async (req, res) => {
    const { id } = req.params;

    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(422).json({
            error: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten()
        });
    }

    const { cursor, limit } = parsed.data;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, isBanned: true }
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
                code: "USER_NOT_FOUND"
            });
        }

        if (user.isBanned) {
            return res.json({
                items: [],
                nextCursor: null
            });
        }

        const posts = await prisma.post.findMany({
            where: {
                authorId: id,
                status: "PUBLISHED",
                ownership: "PERSONAL"
            },
            select: {
                id: true,
                title: true,
                body: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        globalRole: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        });

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, -1) : posts;
        const nextCursor = hasMore ? items[items.length - 1]?.id : null;

        res.json({
            items: items.map((p) => ({
                id: p.id,
                title: p.title,
                // Truncate body for list view
                body: p.body.length > 200 ? p.body.slice(0, 200) + "..." : p.body,
                status: p.status,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                author: p.author ? serializeUserMini(p.author) : undefined
            })),
            nextCursor
        });
    } catch (err) {
        console.error("Failed to get user posts:", err);
        res.status(500).json({ error: "Failed to get user posts" });
    }
});

// ============================================
// GET /users/:id/companies
// ============================================
// Get public company memberships for a user
router.get("/:id/companies", async (req, res) => {
    const { id } = req.params;

    const parsed = PaginationQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(422).json({
            error: "Invalid query parameters",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten()
        });
    }

    const { cursor, limit } = parsed.data;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, isBanned: true }
        });

        if (!user) {
            return res.status(404).json({
                error: "User not found",
                code: "USER_NOT_FOUND"
            });
        }

        if (user.isBanned) {
            return res.json({
                items: [],
                nextCursor: null
            });
        }

        const memberships = await prisma.companyMember.findMany({
            where: { userId: id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        });

        const hasMore = memberships.length > limit;
        const items = hasMore ? memberships.slice(0, -1) : memberships;
        const nextCursor = hasMore ? items[items.length - 1]?.id : null;

        res.json({
            items: items.map((m) => ({
                membershipId: m.id,
                role: m.role,
                joinedAt: m.createdAt.toISOString(),
                company: {
                    id: m.company.id,
                    name: m.company.name,
                    slug: m.company.slug,
                    description: m.company.description
                }
            })),
            nextCursor
        });
    } catch (err) {
        console.error("Failed to get user companies:", err);
        res.status(500).json({ error: "Failed to get user companies" });
    }
});

export default router;
