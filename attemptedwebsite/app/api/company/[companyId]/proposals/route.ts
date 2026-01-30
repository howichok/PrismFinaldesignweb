import { NextResponse } from "next/server";
import { ContentStatus, UpdateStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: Request,
  context: { params: { companyId: string } },
) {
  const params = context.params;
    const { session, response } = await requireAuth();
    if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.companyMembership.findUnique({
        where: {
            companyId_userId: {
                companyId: params.companyId,
                userId: session.userId,
            },
        },
    });

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    if (!type || !status) {
        return NextResponse.json({ error: "Missing 'type' or 'status' query parameter" }, { status: 400 });
    }

    let items;

    const baseSelect = {
        id: true,
        createdAt: true,
        createdBy: {
            select: {
                id: true,
                displayName: true,
                avatarUrl: true,
            }
        }
    };

    if (type === "posts") {
        items = await prisma.post.findMany({
            where: {
                ownerCompanyId: params.companyId,
                status: status as ContentStatus,
            },
            select: {
                ...baseSelect,
                status: true,
                title: true,
            },
            orderBy: { createdAt: "desc" }
        });
    } else if (type === "projects") {
        const projects = await prisma.project.findMany({
            where: {
                ownerCompanyId: params.companyId,
                moderationStatus: status as ContentStatus,
            },
            select: {
                ...baseSelect,
                moderationStatus: true,
                name: true,
            },
            orderBy: { createdAt: "desc" }
        });
        items = projects.map((project) => ({
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            createdBy: project.createdBy,
            status: project.moderationStatus,
        }));
    } else if (type === "updates") {
        items = await prisma.projectUpdate.findMany({
            where: {
                project: {
                    ownerCompanyId: params.companyId,
                },
                status: status as UpdateStatus,
            },
            select: {
                ...baseSelect,
                status: true,
                title: true,
                project: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
    } else {
        return NextResponse.json({ error: "Invalid 'type' specified" }, { status: 400 });
    }

    return NextResponse.json({ items });
}
