import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import cookie from "cookie";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@prismmtr/db";
import { authMiddleware, optionalAuthMiddleware, requireUser, requireRole } from "./middleware/auth.js";
import {
  requestIdMiddleware,
  originProtectionMiddleware,
  rateLimiters,
  getAllowedOrigins,
  isOriginAllowed
} from "./middleware/security.js";
import {
  setSocketServer,
  registerSocket,
  unregisterSocket,
  validateSession,
  bumpRolesVersion
} from "./services/session.js";
import { setSocketIO } from "./services/socket-emitter.js";
import { getUnreadCount } from "./services/notifications.js";
import { validateKeyConfiguration } from "./services/key-management.js";
import { logger } from "./utils/logger.js";
import { initSentry, sentryErrorHandler, sentryRequestHandler } from "./utils/sentry.js";

// Health check routes
import healthRouter from "./routes/health.js";

// Import route modules
import personalProjectsRouter from "./routes/personal-projects.js";
import personalPostsRouter from "./routes/personal-posts.js";
import dashboardRouter from "./routes/dashboard.js";
import moderationRouter from "./routes/moderation.js";
import publicRouter from "./routes/public.js";
import searchRouter from "./routes/search.js";
import notificationsRouter from "./routes/notifications.js";
// Company routes
import companiesRouter from "./routes/companies.js";
import companyHubRouter from "./routes/company-hub.js";
import companyContentRouter from "./routes/company-content.js";
import companyModerationRouter from "./routes/company-moderation.js";
import invitesRouter from "./routes/invites.js";
// Ticket routes
import ticketsRouter from "./routes/tickets.js";
// Admin routes
import adminRouter from "./routes/admin.js";
// Microsoft/Launcher routes
import microsoftAuthRouter from "./routes/microsoft-auth.js";
import launcherRouter from "./routes/launcher.js";
// User profile routes
import usersRouter from "./routes/users.js";

// Test routes (E2E only)
const E2E_TEST_MODE = process.env.E2E_TEST_MODE === "true";

const PORT = Number(process.env.API_PORT ?? 4000);

const app = express();
const allowedOrigins = getAllowedOrigins();

// ============================================
// Initialize Sentry (optional - only if SENTRY_DSN set)
// ============================================
initSentry().catch(console.error);

// ============================================
// Validate Key Configuration on Startup
// ============================================
const keyValidation = validateKeyConfiguration();
if (!keyValidation.valid) {
  logger.error("startup", "Invalid key configuration", { errors: keyValidation.errors });
  console.error("Key configuration errors:", keyValidation.errors);
  // Don't exit - allow app to start but warn
}
if (keyValidation.warnings.length > 0) {
  logger.warn("startup", "Key configuration warnings", { warnings: keyValidation.warnings });
}

// ============================================
// Global Middleware
// ============================================

// Request ID for tracing
app.use(requestIdMiddleware);

// Sentry request handler (adds context per request)
app.use(sentryRequestHandler());

// CORS configuration - allow credentials for cookies
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Origin protection for state-changing requests (CSRF prevention)
app.use(originProtectionMiddleware);

// ============================================
// Public endpoints
// ============================================

// Health check routes
app.use("/health", healthRouter);

// Legacy /health endpoint redirects to /health/live
app.get("/health", (_req, res) => {
  res.redirect(301, "/health/live");
});

// Public routes (no auth required)
app.use("/public", publicRouter);
app.use("/search", searchRouter);

// User profile routes (public)
app.use("/users", usersRouter);

// ============================================
// Protected endpoints
// ============================================

// Get current user info
app.get("/api/me", authMiddleware, requireUser, (req, res) => {
  const { user } = req;
  res.json({
    id: user!.id,
    username: user!.username,
    avatarUrl: user!.avatarUrl,
    globalRole: user!.globalRole,
    rolesVersion: user!.rolesVersion
  });
});

// Personal projects routes
app.use("/personal/projects", personalProjectsRouter);

// Personal posts routes
app.use("/personal/posts", personalPostsRouter);

// Dashboard routes
app.use("/dashboard", dashboardRouter);

// Moderation routes
app.use("/dashboard/mod", moderationRouter);

// Notifications routes
app.use("/notifications", notificationsRouter);

// Company routes
app.use("/companies", companiesRouter);
app.use("/company", companyHubRouter);
app.use("/company", companyContentRouter);
app.use("/company", companyModerationRouter);
app.use("/dashboard/invites", invitesRouter);

// Ticket routes
app.use("/tickets", ticketsRouter);

// Admin routes
app.use("/admin", adminRouter);

// Microsoft authentication routes
app.use("/auth/microsoft", microsoftAuthRouter);

// Launcher routes
app.use("/launcher", launcherRouter);

// ============================================
// E2E Test Routes (only in test mode)
// ============================================
if (E2E_TEST_MODE) {
  console.warn("[SECURITY] E2E_TEST_MODE is enabled - test routes are available!");
  import("./routes/test-routes.js").then(({ default: testRouter }) => {
    app.use("/test", testRouter);
    console.log("[TEST] Test routes mounted at /test");
  }).catch(err => {
    console.error("[TEST] Failed to load test routes:", err);
  });
}

// ============================================
// Error handling
// ============================================

// Sentry error handler (must be before any other error handlers)
app.use(sentryErrorHandler());

// Generic error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("unhandled_error", err.message, {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });

  res.status(500).json({
    error: "Internal server error",
    requestId: req.requestId
  });
});

// Export middleware for use in route files
export { authMiddleware, optionalAuthMiddleware, requireUser, requireRole };

// ============================================
// Socket.io setup with session authentication
// ============================================

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  }
});

// Register io with session service for invalidation events
setSocketServer(io);

// Register io with socket emitter for notifications
setSocketIO(io);

io.on("connection", async (socket) => {
  // Parse cookies from handshake
  const cookies = cookie.parse(socket.handshake.headers.cookie ?? "");
  const sessionId = cookies.prism_session;

  if (!sessionId) {
    socket.emit("error", { code: "NO_SESSION", message: "Not authenticated" });
    socket.disconnect(true);
    return;
  }

  // Validate session
  const result = await validateSession(sessionId);

  if (!result) {
    socket.emit("error", { code: "INVALID_SESSION", message: "Session invalid or expired" });
    socket.disconnect(true);
    return;
  }

  const { user } = result;

  // Store userId on socket for later reference
  (socket as any).userId = user.id;
  (socket as any).sessionId = sessionId;

  // Register socket for this user
  registerSocket(user.id, socket.id);

  // Join user-specific room for targeted events
  socket.join(`user:${user.id}`);

  // Emit authentication success
  socket.emit("authenticated", {
    userId: user.id,
    username: user.username
  });

  // Emit notifications sync with current unread count
  // This ensures badge is correct after (re)connect without polling
  try {
    const unreadCount = await getUnreadCount(user.id);
    socket.emit("notifications.sync", { unreadCount });
  } catch (err) {
    console.error("[Socket] Failed to send notifications.sync:", err);
  }

  // Handle disconnect
  socket.on("disconnect", () => {
    const userId = (socket as any).userId;
    if (userId) {
      unregisterSocket(userId, socket.id);
    }
  });
});

// ============================================
// Start server
// ============================================

server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Allowing CORS from: ${allowedOrigins.join(", ")}`);
});
