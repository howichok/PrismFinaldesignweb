/**
 * Structured Logger
 *
 * Provides consistent JSON logging for critical events.
 * In production, these logs can be parsed by log aggregators.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  context: LogContext;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // JSON format for production
    return JSON.stringify(entry);
  }
  // Human-readable format for development
  const { timestamp, level, event, message, context } = entry;
  const contextStr = Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : "";
  return `[${timestamp}] ${level.toUpperCase()} [${event}] ${message}${contextStr}`;
}

function log(level: LogLevel, event: string, message: string, context: LogContext = {}): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    context
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

// ============================================
// Structured Logging Functions
// ============================================

export const logger = {
  debug: (event: string, message: string, context?: LogContext) =>
    log("debug", event, message, context),

  info: (event: string, message: string, context?: LogContext) =>
    log("info", event, message, context),

  warn: (event: string, message: string, context?: LogContext) =>
    log("warn", event, message, context),

  error: (event: string, message: string, context?: LogContext) =>
    log("error", event, message, context),

  // ============================================
  // Specialized Event Loggers
  // ============================================

  // OAuth events
  oauth: {
    start: (provider: string, userId: string, context?: LogContext) =>
      log("info", "oauth.start", `OAuth flow started for ${provider}`, { userId, provider, ...context }),

    callback: (provider: string, userId: string, success: boolean, context?: LogContext) =>
      log(success ? "info" : "warn", "oauth.callback", `OAuth callback ${success ? "succeeded" : "failed"}`, { userId, provider, success, ...context }),

    tokenRefresh: (userId: string, success: boolean, context?: LogContext) =>
      log(success ? "debug" : "warn", "oauth.token_refresh", `Token refresh ${success ? "succeeded" : "failed"}`, { userId, success, ...context }),

    error: (provider: string, error: string, context?: LogContext) =>
      log("error", "oauth.error", `OAuth error: ${error}`, { provider, error, ...context })
  },

  // Launcher events
  launcher: {
    codeGenerated: (userId: string, context?: LogContext) =>
      log("info", "launcher.code_generated", "Login code generated", { userId, ...context }),

    codeExchanged: (userId: string, success: boolean, context?: LogContext) =>
      log(success ? "info" : "warn", "launcher.code_exchanged", `Code exchange ${success ? "succeeded" : "failed"}`, { userId, success, ...context }),

    sessionCreated: (userId: string, sessionId: string, context?: LogContext) =>
      log("info", "launcher.session_created", "Launcher session created", { userId, sessionId, ...context }),

    sessionRevoked: (userId: string, sessionId: string, context?: LogContext) =>
      log("info", "launcher.session_revoked", "Launcher session revoked", { userId, sessionId, ...context })
  },

  // Security events
  security: {
    rateLimited: (key: string, context?: LogContext) =>
      log("warn", "security.rate_limited", `Rate limit exceeded: ${key}`, { key, ...context }),

    originBlocked: (origin: string, context?: LogContext) =>
      log("warn", "security.origin_blocked", `Request blocked due to invalid origin: ${origin}`, { origin, ...context }),

    sessionInvalidated: (userId: string, reason: string, context?: LogContext) =>
      log("info", "security.session_invalidated", `Sessions invalidated: ${reason}`, { userId, reason, ...context }),

    banned: (userId: string, context?: LogContext) =>
      log("warn", "security.user_banned", "Banned user attempted action", { userId, ...context })
  },

  // Admin events
  admin: {
    userUpdated: (adminId: string, targetUserId: string, changes: Record<string, unknown>, context?: LogContext) =>
      log("info", "admin.user_updated", "Admin updated user", { adminId, targetUserId, changes, ...context }),

    roleChanged: (adminId: string, targetUserId: string, oldRole: string, newRole: string, context?: LogContext) =>
      log("info", "admin.role_changed", `Role changed from ${oldRole} to ${newRole}`, { adminId, targetUserId, oldRole, newRole, ...context }),

    moderationAction: (adminId: string, action: string, contentType: string, contentId: string, context?: LogContext) =>
      log("info", "admin.moderation_action", `Moderation action: ${action}`, { adminId, action, contentType, contentId, ...context })
  },

  // Retention job events
  retention: {
    started: (jobName: string, context?: LogContext) =>
      log("info", "retention.started", `Retention job started: ${jobName}`, { jobName, ...context }),

    completed: (jobName: string, deletedCount: number, context?: LogContext) =>
      log("info", "retention.completed", `Retention job completed: ${jobName} (${deletedCount} deleted)`, { jobName, deletedCount, ...context }),

    error: (jobName: string, error: string, context?: LogContext) =>
      log("error", "retention.error", `Retention job failed: ${jobName}`, { jobName, error, ...context })
  },

  // ============================================
  // Metrics via Logs (for aggregation/monitoring)
  // ============================================
  metrics: {
    // OAuth metrics
    oauthDiscordSuccess: (userId: string, context?: LogContext) =>
      log("info", "metrics.oauth.discord.success", "Discord OAuth succeeded", { userId, metric: "oauth.discord.success", value: 1, ...context }),

    oauthDiscordFail: (reason: string, context?: LogContext) =>
      log("warn", "metrics.oauth.discord.fail", `Discord OAuth failed: ${reason}`, { metric: "oauth.discord.fail", value: 1, reason, ...context }),

    oauthMicrosoftSuccess: (userId: string, context?: LogContext) =>
      log("info", "metrics.oauth.microsoft.success", "Microsoft OAuth succeeded", { userId, metric: "oauth.microsoft.success", value: 1, ...context }),

    oauthMicrosoftFail: (reason: string, context?: LogContext) =>
      log("warn", "metrics.oauth.microsoft.fail", `Microsoft OAuth failed: ${reason}`, { metric: "oauth.microsoft.fail", value: 1, reason, ...context }),

    // Launcher exchange metrics
    launcherExchangeSuccess: (userId: string, context?: LogContext) =>
      log("info", "metrics.launcher.exchange.success", "Launcher code exchange succeeded", { userId, metric: "launcher.exchange.success", value: 1, ...context }),

    launcherExchangeFail: (reason: string, context?: LogContext) =>
      log("warn", "metrics.launcher.exchange.fail", `Launcher code exchange failed: ${reason}`, { metric: "launcher.exchange.fail", value: 1, reason, ...context }),

    // Moderation decision metrics
    moderationApprove: (moderatorId: string, contentType: string, contentId: string, context?: LogContext) =>
      log("info", "metrics.moderation.decision.approve", "Content approved", { moderatorId, contentType, contentId, metric: "moderation.decision.approve", value: 1, ...context }),

    moderationNeedsChanges: (moderatorId: string, contentType: string, contentId: string, context?: LogContext) =>
      log("info", "metrics.moderation.decision.needs_changes", "Content needs changes", { moderatorId, contentType, contentId, metric: "moderation.decision.needs_changes", value: 1, ...context }),

    moderationReject: (moderatorId: string, contentType: string, contentId: string, context?: LogContext) =>
      log("info", "metrics.moderation.decision.reject", "Content rejected", { moderatorId, contentType, contentId, metric: "moderation.decision.reject", value: 1, ...context }),

    // Ticket metrics
    ticketCreated: (userId: string, category: string, context?: LogContext) =>
      log("info", "metrics.tickets.created", "Ticket created", { userId, category, metric: "tickets.created", value: 1, ...context }),

    ticketMessage: (ticketId: string, isStaff: boolean, context?: LogContext) =>
      log("info", "metrics.tickets.message", "Ticket message added", { ticketId, isStaff, metric: "tickets.message", value: 1, ...context }),

    ticketStatusChange: (ticketId: string, oldStatus: string, newStatus: string, context?: LogContext) =>
      log("info", "metrics.tickets.status_change", `Ticket status changed: ${oldStatus} → ${newStatus}`, { ticketId, oldStatus, newStatus, metric: "tickets.status_change", value: 1, ...context })
  }
};

export default logger;
