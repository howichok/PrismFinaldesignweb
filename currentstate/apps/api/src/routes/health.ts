/**
 * Health Check Routes
 *
 * Provides liveness, readiness, and version endpoints for container orchestration.
 */

import { Router } from "express";
import { prisma } from "@prismmtr/db";
import { validateKeyConfiguration, getCurrentKeyVersion } from "../services/key-management.js";

const router = Router();

// ============================================
// GET /health/live
// ============================================
// Simple liveness check - process is running
router.get("/live", (_req, res) => {
    res.json({
        ok: true,
        service: "prismmtr-api",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GET /health/ready
// ============================================
// Readiness check - can serve traffic
router.get("/ready", async (req, res) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};
    let allOk = true;

    // Check 1: Database connectivity
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { ok: true };
    } catch (error) {
        checks.database = {
            ok: false,
            error: error instanceof Error ? error.message : "Database connection failed"
        };
        allOk = false;
    }

    // Check 2: Crypto keys for current version
    try {
        const keyValidation = validateKeyConfiguration();
        if (keyValidation.valid) {
            checks.cryptoKeys = { ok: true };
        } else {
            checks.cryptoKeys = {
                ok: false,
                error: keyValidation.errors.join("; ")
            };
            allOk = false;
        }
    } catch (error) {
        checks.cryptoKeys = {
            ok: false,
            error: error instanceof Error ? error.message : "Key validation failed"
        };
        allOk = false;
    }

    const status = allOk ? 200 : 503;
    res.status(status).json({
        ok: allOk,
        service: "prismmtr-api",
        timestamp: new Date().toISOString(),
        checks,
        requestId: req.requestId,
        ...(allOk ? {} : { reason: "One or more health checks failed" })
    });
});

// ============================================
// GET /health/version
// ============================================
// Version information for deployment tracking
router.get("/version", (_req, res) => {
    res.json({
        ok: true,
        service: "prismmtr-api",
        gitSha: process.env.GIT_SHA || "unknown",
        buildTime: process.env.BUILD_TIME || "unknown",
        keyVersion: getCurrentKeyVersion(),
        nodeEnv: process.env.NODE_ENV || "development"
    });
});

export default router;
