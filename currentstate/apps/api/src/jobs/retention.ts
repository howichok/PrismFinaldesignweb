/**
 * Retention Jobs
 *
 * Scheduled cleanup tasks for expired/old data.
 * Run via CLI or scheduled job runner (node-cron).
 *
 * Environment Variables:
 * - RETENTION_AUTH_SESSION_DAYS: Days to keep expired/revoked auth sessions (default: 30)
 * - RETENTION_LAUNCHER_SESSION_DAYS: Days to keep expired launcher sessions (default: 30)
 * - RETENTION_LOGIN_CODE_HOURS: Hours to keep consumed/expired login codes (default: 24)
 * - RETENTION_OAUTH_STATE_HOURS: Hours to keep expired OAuth states (default: 24)
 * - RETENTION_DRAFT_CONTENT_DAYS: Days to keep old drafts never submitted (default: 90)
 * - RETENTION_EVENT_LOG_DAYS: Days to keep event logs (default: 90)
 */

import { prisma } from "@prismmtr/db";
import { logger } from "../utils/logger.js";

// ============================================
// Configuration
// ============================================

interface RetentionConfig {
  authSessionDays: number;
  launcherSessionDays: number;
  loginCodeHours: number;
  oauthStateHours: number;
  draftContentDays: number;
  eventLogDays: number;
}

function getRetentionConfig(): RetentionConfig {
  return {
    authSessionDays: parseInt(process.env.RETENTION_AUTH_SESSION_DAYS || "30", 10),
    launcherSessionDays: parseInt(process.env.RETENTION_LAUNCHER_SESSION_DAYS || "30", 10),
    loginCodeHours: parseInt(process.env.RETENTION_LOGIN_CODE_HOURS || "24", 10),
    oauthStateHours: parseInt(process.env.RETENTION_OAUTH_STATE_HOURS || "24", 10),
    draftContentDays: parseInt(process.env.RETENTION_DRAFT_CONTENT_DAYS || "90", 10),
    eventLogDays: parseInt(process.env.RETENTION_EVENT_LOG_DAYS || "90", 10)
  };
}

// ============================================
// Cleanup Functions
// ============================================

/**
 * Purge expired or revoked AuthSessions older than N days.
 */
export async function purgeExpiredAuthSessions(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.authSessionDays * 24 * 60 * 60 * 1000);

  logger.retention.started("purgeExpiredAuthSessions");

  try {
    const result = await prisma.authSession.deleteMany({
      where: {
        OR: [
          // Expired sessions
          { expiresAt: { lt: cutoffDate } },
          // Revoked sessions older than cutoff
          {
            revokedAt: { not: null },
            revokedAt: { lt: cutoffDate }
          }
        ]
      }
    });

    logger.retention.completed("purgeExpiredAuthSessions", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeExpiredAuthSessions", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Purge expired LauncherSessions older than N days.
 */
export async function purgeExpiredLauncherSessions(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.launcherSessionDays * 24 * 60 * 60 * 1000);

  logger.retention.started("purgeExpiredLauncherSessions");

  try {
    const result = await prisma.launcherSession.deleteMany({
      where: {
        OR: [
          // Expired sessions
          { expiresAt: { lt: cutoffDate } },
          // Revoked sessions older than cutoff
          {
            revokedAt: { not: null },
            revokedAt: { lt: cutoffDate }
          }
        ]
      }
    });

    logger.retention.completed("purgeExpiredLauncherSessions", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeExpiredLauncherSessions", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Purge expired or consumed LauncherLoginCodes older than N hours.
 */
export async function purgeExpiredLoginCodes(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.loginCodeHours * 60 * 60 * 1000);

  logger.retention.started("purgeExpiredLoginCodes");

  try {
    const result = await prisma.launcherLoginCode.deleteMany({
      where: {
        OR: [
          // Expired codes
          { expiresAt: { lt: cutoffDate } },
          // Consumed codes older than cutoff
          {
            consumedAt: { not: null },
            createdAt: { lt: cutoffDate }
          }
        ]
      }
    });

    logger.retention.completed("purgeExpiredLoginCodes", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeExpiredLoginCodes", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Purge expired MicrosoftOAuthStates older than N hours.
 */
export async function purgeExpiredOAuthStates(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.oauthStateHours * 60 * 60 * 1000);

  logger.retention.started("purgeExpiredOAuthStates");

  try {
    const result = await prisma.microsoftOAuthState.deleteMany({
      where: {
        expiresAt: { lt: cutoffDate }
      }
    });

    logger.retention.completed("purgeExpiredOAuthStates", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeExpiredOAuthStates", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Purge old DRAFT projects that were never submitted.
 * Only deletes projects that have been in DRAFT status for more than N days
 * and have never had a moderation item created.
 */
export async function purgeOldDraftProjects(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.draftContentDays * 24 * 60 * 60 * 1000);

  logger.retention.started("purgeOldDraftProjects");

  try {
    // Find old drafts without moderation items (never submitted)
    const oldDrafts = await prisma.project.findMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: cutoffDate },
        moderation: null // Never had a moderation item
      },
      select: { id: true }
    });

    if (oldDrafts.length === 0) {
      logger.retention.completed("purgeOldDraftProjects", 0);
      return 0;
    }

    const result = await prisma.project.deleteMany({
      where: {
        id: { in: oldDrafts.map((d) => d.id) }
      }
    });

    logger.retention.completed("purgeOldDraftProjects", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeOldDraftProjects", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Purge old DRAFT posts that were never submitted.
 */
export async function purgeOldDraftPosts(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.draftContentDays * 24 * 60 * 60 * 1000);

  logger.retention.started("purgeOldDraftPosts");

  try {
    // Find old drafts without moderation items (never submitted)
    const oldDrafts = await prisma.post.findMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: cutoffDate },
        moderation: null // Never had a moderation item
      },
      select: { id: true }
    });

    if (oldDrafts.length === 0) {
      logger.retention.completed("purgeOldDraftPosts", 0);
      return 0;
    }

    const result = await prisma.post.deleteMany({
      where: {
        id: { in: oldDrafts.map((d) => d.id) }
      }
    });

    logger.retention.completed("purgeOldDraftPosts", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("purgeOldDraftPosts", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Prune old EventLog entries of certain types.
 * Keeps moderation and admin events, prunes noisy events.
 */
export async function pruneOldEventLogs(): Promise<number> {
  const config = getRetentionConfig();
  const cutoffDate = new Date(Date.now() - config.eventLogDays * 24 * 60 * 60 * 1000);

  logger.retention.started("pruneOldEventLogs");

  // Event types to prune (noisy/less important)
  const prunableTypes = [
    "SESSION_CREATED",
    "LAUNCHER_SESSION_CREATED",
    "LAUNCHER_SESSION_LOGOUT",
    "MICROSOFT_VERIFIED",
    "NOTIFICATION_READ"
  ];

  try {
    const result = await prisma.eventLog.deleteMany({
      where: {
        type: { in: prunableTypes },
        createdAt: { lt: cutoffDate }
      }
    });

    logger.retention.completed("pruneOldEventLogs", result.count);
    return result.count;
  } catch (error) {
    logger.retention.error("pruneOldEventLogs", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

// ============================================
// Run All Jobs
// ============================================

export interface RetentionResults {
  authSessions: number;
  launcherSessions: number;
  loginCodes: number;
  oauthStates: number;
  draftProjects: number;
  draftPosts: number;
  eventLogs: number;
  totalDeleted: number;
  errors: string[];
}

/**
 * Run all retention jobs.
 */
export async function runAllRetentionJobs(): Promise<RetentionResults> {
  const results: RetentionResults = {
    authSessions: 0,
    launcherSessions: 0,
    loginCodes: 0,
    oauthStates: 0,
    draftProjects: 0,
    draftPosts: 0,
    eventLogs: 0,
    totalDeleted: 0,
    errors: []
  };

  console.log("[Retention] Starting retention jobs...");
  const startTime = Date.now();

  // Run each job and collect results
  try {
    results.authSessions = await purgeExpiredAuthSessions();
  } catch (e) {
    results.errors.push(`authSessions: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.launcherSessions = await purgeExpiredLauncherSessions();
  } catch (e) {
    results.errors.push(`launcherSessions: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.loginCodes = await purgeExpiredLoginCodes();
  } catch (e) {
    results.errors.push(`loginCodes: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.oauthStates = await purgeExpiredOAuthStates();
  } catch (e) {
    results.errors.push(`oauthStates: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.draftProjects = await purgeOldDraftProjects();
  } catch (e) {
    results.errors.push(`draftProjects: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.draftPosts = await purgeOldDraftPosts();
  } catch (e) {
    results.errors.push(`draftPosts: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  try {
    results.eventLogs = await pruneOldEventLogs();
  } catch (e) {
    results.errors.push(`eventLogs: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  results.totalDeleted =
    results.authSessions +
    results.launcherSessions +
    results.loginCodes +
    results.oauthStates +
    results.draftProjects +
    results.draftPosts +
    results.eventLogs;

  const duration = Date.now() - startTime;
  console.log(`[Retention] Completed in ${duration}ms. Total deleted: ${results.totalDeleted}`);

  if (results.errors.length > 0) {
    console.warn(`[Retention] Errors: ${results.errors.join(", ")}`);
  }

  return results;
}
