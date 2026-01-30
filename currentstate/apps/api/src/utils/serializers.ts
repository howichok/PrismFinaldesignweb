/**
 * Serializers - Common helpers for DTO serialization
 *
 * Provides consistent mapping of database models to DTOs across all routes.
 */

import type { GlobalRole } from "@prismmtr/shared";

// User select fields for includes
export const userMiniSelect = {
    id: true,
    username: true,
    avatarUrl: true,
    globalRole: true
} as const;

// User type from Prisma select
export interface UserMiniInput {
    id: string;
    username: string;
    avatarUrl: string | null;
    globalRole: string;
}

/**
 * Convert a User record to UserMiniDTO format
 */
export function toUserMini(user: UserMiniInput | null | undefined) {
    if (!user) return undefined;

    return {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole as GlobalRole
    };
}

/**
 * Format a project with UserMiniDTO for author
 */
export function formatProjectDTO(project: any) {
    return {
        id: project.id,
        title: project.title,
        description: project.description,
        type: project.type,
        ownership: project.ownership,
        status: project.status,
        authorId: project.authorId,
        ownerUserId: project.ownerUserId,
        ownerCompanyId: project.ownerCompanyId ?? null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        author: toUserMini(project.author),
        ownerCompany: project.ownerCompany
            ? {
                id: project.ownerCompany.id,
                name: project.ownerCompany.name,
                slug: project.ownerCompany.slug
            }
            : null,
        moderation: project.moderation
            ? {
                id: project.moderation.id,
                status: project.moderation.status,
                reason: project.moderation.reason,
                checklistJson: project.moderation.checklistJson,
                decidedAt: project.moderation.decidedAt?.toISOString() ?? null
            }
            : null
    };
}

/**
 * Format a post with UserMiniDTO for author
 */
export function formatPostDTO(post: any) {
    return {
        id: post.id,
        title: post.title,
        body: post.body,
        ownership: post.ownership,
        status: post.status,
        authorId: post.authorId,
        ownerUserId: post.ownerUserId,
        ownerCompanyId: post.ownerCompanyId ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: toUserMini(post.author),
        ownerCompany: post.ownerCompany
            ? {
                id: post.ownerCompany.id,
                name: post.ownerCompany.name,
                slug: post.ownerCompany.slug
            }
            : null,
        moderation: post.moderation
            ? {
                id: post.moderation.id,
                status: post.moderation.status,
                reason: post.moderation.reason,
                checklistJson: post.moderation.checklistJson,
                decidedAt: post.moderation.decidedAt?.toISOString() ?? null
            }
            : null
    };
}

/**
 * Format a ticket with UserMiniDTO for author and assignedTo
 */
export function formatTicketDTO(ticket: any) {
    return {
        id: ticket.id,
        authorId: ticket.authorId,
        category: ticket.category,
        status: ticket.status,
        title: ticket.title,
        assignedToId: ticket.assignedToId,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        lastMessageAt: ticket.lastMessageAt.toISOString(),
        author: toUserMini(ticket.author),
        assignedTo: toUserMini(ticket.assignedTo),
        messages: ticket.messages?.map((m: any) => formatTicketMessageDTO(m)),
        messageCount: ticket.messageCount ?? ticket._count?.messages
    };
}

/**
 * Format a ticket message with UserMiniDTO for author
 */
export function formatTicketMessageDTO(message: any) {
    return {
        id: message.id,
        ticketId: message.ticketId,
        authorId: message.authorId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        author: toUserMini(message.author)
    };
}

/**
 * Format a company member with UserMiniDTO for user
 */
export function formatCompanyMemberDTO(member: any) {
    return {
        id: member.id,
        companyId: member.companyId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
        user: toUserMini(member.user)
    };
}

/**
 * Format a join request with UserMiniDTO for user
 */
export function formatJoinRequestDTO(request: any) {
    return {
        id: request.id,
        companyId: request.companyId,
        userId: request.userId,
        message: request.message,
        status: request.status,
        decidedById: request.decidedById,
        decidedAt: request.decidedAt?.toISOString() ?? null,
        reason: request.reason,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        user: toUserMini(request.user),
        decidedBy: request.decidedBy
            ? { id: request.decidedBy.id, username: request.decidedBy.username }
            : null
    };
}
