import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, type User, type AuthSession } from "@prismmtr/db";
import { validateSession } from "../services/session.js";

// Extend Express Request to include authenticated user and session
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: AuthSession;
      supabaseUserId?: string;
    }
  }
}

/**
 * Primary auth middleware using PrismMTR session cookie.
 *
 * Authentication flow:
 * 1. Read prism_session cookie
 * 2. Validate session in database (not revoked, not expired)
 * 3. Check rolesVersion matches - auto-revoke if not
 * 4. Attach user and session to request
 *
 * Falls back to Supabase JWT if no cookie present (for backward compatibility).
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Try cookie-based auth first (preferred)
  const sessionId = req.cookies?.prism_session;

  if (sessionId) {
    try {
      const result = await validateSession(sessionId);

      if (result) {
        req.user = result.user;
        req.session = result.session;
        next();
        return;
      }

      // Session invalid (revoked, expired, or rolesVersion mismatch)
      res.status(401).json({
        error: "Session invalid or expired",
        code: "SESSION_INVALID"
      });
      return;
    } catch (err) {
      console.error("Session validation error:", err);
      res.status(401).json({ error: "Authentication failed" });
      return;
    }
  }

  // Fallback: Try Supabase JWT (for backward compatibility or API-only clients)
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    try {
      const decoded = jwt.decode(token) as {
        sub?: string;
        user_metadata?: {
          provider_id?: string;
        };
        exp?: number;
      } | null;

      if (!decoded) {
        res.status(401).json({ error: "Invalid token format" });
        return;
      }

      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        res.status(401).json({ error: "Token expired" });
        return;
      }

      const discordId = decoded.user_metadata?.provider_id;

      if (discordId) {
        const user = await prisma.user.findUnique({
          where: { discordId }
        });

        if (user) {
          req.user = user;
          req.supabaseUserId = decoded.sub;
          next();
          return;
        }
      }

      res.status(401).json({ error: "User not found" });
      return;
    } catch (err) {
      console.error("JWT auth error:", err);
      res.status(401).json({ error: "Authentication failed" });
      return;
    }
  }

  // No valid auth method found
  res.status(401).json({ error: "Authentication required" });
}

/**
 * Optional auth middleware - attaches user if authenticated but doesn't require it.
 * Use for routes that work differently for authenticated vs anonymous users.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.cookies?.prism_session;

  if (sessionId) {
    try {
      const result = await validateSession(sessionId);
      if (result) {
        req.user = result.user;
        req.session = result.session;
      }
    } catch (err) {
      // Ignore errors for optional auth
    }
  }

  next();
}

/**
 * Middleware that requires a fully authenticated user (must exist in DB).
 * Use after authMiddleware for protected routes.
 */
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(403).json({ error: "User not found. Please sign in again." });
    return;
  }
  next();
}

/**
 * Middleware that requires specific global roles.
 * Use after requireUser for admin/mod-only routes.
 */
export function requireRole(...roles: Array<"ADMIN" | "MOD" | "USER">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(403).json({ error: "User not found" });
      return;
    }

    if (!roles.includes(req.user.globalRole)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
