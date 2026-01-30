/**
 * Sentry Integration
 *
 * Optional error tracking with Sentry. Initializes only if SENTRY_DSN is set.
 * Provides Express error handler and context helpers.
 */

import type { Request, Response, NextFunction } from "express";

// Check if Sentry should be enabled
const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_SENTRY_ENABLED = Boolean(SENTRY_DSN);

// Dynamic import to avoid loading Sentry if not needed
let Sentry: typeof import("@sentry/node") | null = null;

/**
 * Initialize Sentry. Call once at app startup before other imports.
 */
export async function initSentry(): Promise<void> {
    if (!IS_SENTRY_ENABLED) {
        console.log("[Sentry] Disabled - SENTRY_DSN not configured");
        return;
    }

    try {
        Sentry = await import("@sentry/node");
        Sentry.init({
            dsn: SENTRY_DSN,
            environment: process.env.NODE_ENV || "development",
            release: process.env.GIT_SHA || "unknown",

            // Performance: sample 10% of transactions in production
            tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

            // Don't send PII
            sendDefaultPii: false,

            // Attach request data
            integrations: [],

            // Before sending, sanitize sensitive data
            beforeSend(event) {
                // Remove cookies from request headers
                if (event.request?.headers) {
                    delete event.request.headers.cookie;
                    delete event.request.headers.authorization;
                }
                return event;
            }
        });

        console.log("[Sentry] Initialized successfully");
    } catch (error) {
        console.error("[Sentry] Failed to initialize:", error);
    }
}

/**
 * Capture an exception with optional context.
 */
export function captureException(
    error: Error | unknown,
    context?: {
        requestId?: string;
        userId?: string;
        route?: string;
        extra?: Record<string, unknown>;
    }
): void {
    if (!IS_SENTRY_ENABLED || !Sentry) {
        return;
    }

    Sentry.withScope((scope) => {
        if (context?.requestId) {
            scope.setTag("requestId", context.requestId);
        }
        if (context?.userId) {
            scope.setUser({ id: context.userId });
        }
        if (context?.route) {
            scope.setTag("route", context.route);
        }
        scope.setTag("service", "api");

        if (context?.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }

        Sentry.captureException(error);
    });
}

/**
 * Set user context for subsequent captures in this request.
 */
export function setUserContext(userId: string, username?: string): void {
    if (!IS_SENTRY_ENABLED || !Sentry) {
        return;
    }
    Sentry.setUser({ id: userId, username });
}

/**
 * Clear user context (on logout/error).
 */
export function clearUserContext(): void {
    if (!IS_SENTRY_ENABLED || !Sentry) {
        return;
    }
    Sentry.setUser(null);
}

/**
 * Express error handler middleware for Sentry.
 * Must be added AFTER all routes but BEFORE any custom error handlers.
 */
export function sentryErrorHandler() {
    return (err: Error, req: Request, res: Response, next: NextFunction): void => {
        if (IS_SENTRY_ENABLED && Sentry) {
            captureException(err, {
                requestId: req.requestId,
                userId: req.user?.id,
                route: `${req.method} ${req.path}`,
                extra: {
                    query: req.query,
                    body: req.body ? "[REDACTED]" : undefined
                }
            });
        }

        // Pass to next error handler
        next(err);
    };
}

/**
 * Express request handler that adds Sentry context per-request.
 */
export function sentryRequestHandler() {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (IS_SENTRY_ENABLED && Sentry) {
            Sentry.withScope((scope) => {
                scope.setTag("requestId", req.requestId || "unknown");
                scope.setTag("route", `${req.method} ${req.path}`);
                scope.setTag("service", "api");
            });
        }
        next();
    };
}

/**
 * Check if Sentry is enabled and initialized.
 */
export function isSentryEnabled(): boolean {
    return IS_SENTRY_ENABLED && Sentry !== null;
}
