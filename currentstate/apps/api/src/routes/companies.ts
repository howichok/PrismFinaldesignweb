import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { authMiddleware, requireUser, optionalAuthMiddleware } from "../middleware/auth.js";
import { CreateCompanyInput } from "@prismmtr/shared";
import crypto from "crypto";

const router = Router();

/**
 * POST /companies
 * Create a new company. User becomes the OWNER.
 */
router.post("/", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  const parsed = CreateCompanyInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  const { name, slug, description } = parsed.data;

  try {
    // Check if slug is already taken
    const existing = await prisma.company.findUnique({
      where: { slug }
    });

    if (existing) {
      res.status(409).json({
        error: "A company with this slug already exists",
        code: "SLUG_TAKEN"
      });
      return;
    }

    // Check user permission overrides
    const overrides = await prisma.userPermissionOverrides.findUnique({
      where: { userId }
    });

    // For MVP, allow creation without moderation
    // TODO: Add company creation moderation if !overrides?.canCreateCompanyWithoutPremod

    // Create company and membership in transaction
    const company = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name,
          slug,
          description: description ?? null,
          createdById: userId
        }
      });

      // Create OWNER membership
      await tx.companyMember.create({
        data: {
          companyId: newCompany.id,
          userId,
          role: "OWNER"
        }
      });

      return newCompany;
    });

    res.status(201).json(formatCompany(company, { myRole: "OWNER", memberCount: 1 }));
  } catch (err) {
    console.error("Failed to create company:", err);
    res.status(500).json({ error: "Failed to create company" });
  }
});

/**
 * GET /companies/:idOrSlug
 * Get a company by ID or slug (public info)
 */
router.get("/:idOrSlug", optionalAuthMiddleware, async (req, res) => {
  const { idOrSlug } = req.params;
  const userId = req.user?.id;

  try {
    // Try to find by ID first, then by slug
    let company = await prisma.company.findUnique({
      where: { id: idOrSlug },
      include: {
        createdBy: {
          select: { id: true, username: true, avatarUrl: true }
        },
        _count: { select: { members: true } }
      }
    });

    if (!company) {
      company = await prisma.company.findUnique({
        where: { slug: idOrSlug },
        include: {
          createdBy: {
            select: { id: true, username: true, avatarUrl: true }
          },
          _count: { select: { members: true } }
        }
      });
    }

    if (!company) {
      res.status(404).json({ error: "Company not found", code: "NOT_FOUND" });
      return;
    }

    // Get user's role if authenticated
    let myRole: string | null = null;
    if (userId) {
      const membership = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: company.id, userId } }
      });
      myRole = membership?.role ?? null;
    }

    res.json(formatCompany(company, { myRole, memberCount: company._count.members }));
  } catch (err) {
    console.error("Failed to get company:", err);
    res.status(500).json({ error: "Failed to get company" });
  }
});

/**
 * GET /dashboard/companies
 * List companies the current user is a member of
 */
router.get("/", authMiddleware, requireUser, async (req, res) => {
  const userId = req.user!.id;

  try {
    const memberships = await prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: {
          include: {
            createdBy: {
              select: { id: true, username: true, avatarUrl: true }
            },
            _count: { select: { members: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const companies = memberships.map(m => ({
      ...formatCompany(m.company, { memberCount: m.company._count.members }),
      myRole: m.role
    }));

    res.json({
      items: companies,
      total: companies.length
    });
  } catch (err) {
    console.error("Failed to list companies:", err);
    res.status(500).json({ error: "Failed to list companies" });
  }
});

// Helper to format company response
function formatCompany(company: any, options?: { myRole?: string | null; memberCount?: number }) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    description: company.description,
    publishingMode: company.publishingMode,
    joinMode: company.joinMode,
    joinMessageMode: company.joinMessageMode,
    allowTrustedApproveJoinRequests: company.allowTrustedApproveJoinRequests,
    createdById: company.createdById,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    createdBy: company.createdBy,
    memberCount: options?.memberCount,
    myRole: options?.myRole ?? null
  };
}

export default router;
