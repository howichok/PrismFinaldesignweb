import "server-only";

import {
  ContentStatus,
  ModerationRequestStatus,
  ModerationTargetType,
  NotificationType,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type Decision = "APPROVE" | "DENY";

type ModerationResult = {
  requestId: string;
  status: ModerationRequestStatus;
  targetType: ModerationTargetType;
  targetId: string;
};

type TargetInfo = {
  title: string;
};

function buildNotificationTitle(type: ModerationTargetType, approved: boolean) {
  const label =
    type === ModerationTargetType.POST
      ? "post"
      : type === ModerationTargetType.PROJECT
        ? "project"
        : "company";
  return approved
    ? `Your ${label} was approved`
    : `Your ${label} was rejected`;
}

function buildNotificationLink(type: ModerationTargetType) {
  switch (type) {
    case ModerationTargetType.POST:
      return "/dashboard/posts";
    case ModerationTargetType.PROJECT:
      return "/dashboard/projects";
    default:
      return "/dashboard/companies";
  }
}

async function getTargetInfo(
  tx: any,
  type: ModerationTargetType,
  targetId: string,
): Promise<TargetInfo | null> {
  if (type === ModerationTargetType.POST) {
    const post = await tx.post.findUnique({
      where: { id: targetId },
      select: {
        title: true,
      },
    });
    if (!post) return null;
    return {
      title: post.title,
    };
  }

  if (type === ModerationTargetType.PROJECT) {
    const project = await tx.project.findUnique({
      where: { id: targetId },
      select: {
        name: true,
      },
    });
    if (!project) return null;
    return {
      title: project.name,
    };
  }

  const company = await tx.company.findUnique({
    where: { id: targetId },
    select: {
      name: true,
    },
  });
  if (!company) return null;
  return {
    title: company.name,
  };
}

export async function moderateRequest(params: {
  requestId: string;
  reviewerId: string;
  decision: Decision;
  reason?: string | null;
}): Promise<ModerationResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.moderationRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) {
      throw new Error("NOT_FOUND");
    }
    if (request.status !== ModerationRequestStatus.PENDING) {
      throw new Error("NOT_PENDING");
    }

    const targetInfo = await getTargetInfo(
      tx,
      request.targetType,
      request.targetId,
    );
    if (!targetInfo) {
      throw new Error("TARGET_NOT_FOUND");
    }

    const now = new Date();
    const approved = params.decision === "APPROVE";
    const rejectionReason = approved ? null : params.reason?.trim() ?? null;

    if (!approved && !rejectionReason) {
      throw new Error("MISSING_REASON");
    }

    if (request.targetType === ModerationTargetType.POST) {
      const post = await tx.post.findUnique({
        where: { id: request.targetId },
        select: { publishedAt: true },
      });
      if (!post) throw new Error("TARGET_NOT_FOUND");
      await tx.post.update({
        where: { id: request.targetId },
        data: {
          status: approved ? ContentStatus.APPROVED : ContentStatus.REJECTED,
          publishedAt: approved ? post.publishedAt ?? now : post.publishedAt,
          rejectionReason: rejectionReason,
        },
      });
    } else if (request.targetType === ModerationTargetType.PROJECT) {
      const project = await tx.project.findUnique({
        where: { id: request.targetId },
        select: { publishedAt: true },
      });
      if (!project) throw new Error("TARGET_NOT_FOUND");
      await tx.project.update({
        where: { id: request.targetId },
        data: {
          moderationStatus: approved
            ? ContentStatus.APPROVED
            : ContentStatus.REJECTED,
          publishedAt: approved ? project.publishedAt ?? now : project.publishedAt,
          rejectionReason: rejectionReason,
        },
      });
    } else {
      const company = await tx.company.findUnique({
        where: { id: request.targetId },
        select: { publishedAt: true },
      });
      if (!company) throw new Error("TARGET_NOT_FOUND");
      await tx.company.update({
        where: { id: request.targetId },
        data: {
          visibilityStatus: approved
            ? ContentStatus.APPROVED
            : ContentStatus.REJECTED,
          publishedAt: approved ? company.publishedAt ?? now : company.publishedAt,
          rejectionReason: rejectionReason,
        },
      });
    }

    const updatedRequest = await tx.moderationRequest.update({
      where: { id: request.id },
      data: {
        status: approved
          ? ModerationRequestStatus.APPROVED
          : ModerationRequestStatus.REJECTED,
        reviewedByUserId: params.reviewerId,
        reviewedAt: now,
        reason: rejectionReason,
      },
      select: {
        id: true,
        status: true,
        targetType: true,
        targetId: true,
      },
    });

    await tx.notification.create({
      data: {
        userId: request.submittedByUserId,
        type: NotificationType.MODERATION,
        title: buildNotificationTitle(request.targetType, approved),
        body: approved
          ? `${targetInfo.title} is now approved.`
          : `Reason: ${rejectionReason}`,
        link: buildNotificationLink(request.targetType),
        isRead: false,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: params.reviewerId,
        actionType: approved ? "MODERATION_APPROVE" : "MODERATION_DENY",
        targetType: request.targetType,
        targetId: request.targetId,
        meta: {
          requestId: request.id,
          reason: rejectionReason,
          title: targetInfo.title,
        },
      },
    });

    return {
      requestId: updatedRequest.id,
      status: updatedRequest.status,
      targetType: updatedRequest.targetType,
      targetId: updatedRequest.targetId,
    };
  });
}
