#!/usr/bin/env npx tsx

/**
 * CLI Script: Run Retention Jobs
 *
 * Usage:
 *   npx tsx src/scripts/run-retention.ts
 *   npx tsx src/scripts/run-retention.ts --dry-run
 *   npx tsx src/scripts/run-retention.ts --job=authSessions
 *
 * Options:
 *   --dry-run      Show what would be deleted without actually deleting
 *   --job=<name>   Run a specific job only (authSessions, launcherSessions, etc.)
 */

import "dotenv/config";
import { prisma } from "@prismmtr/db";
import {
  runAllRetentionJobs,
  purgeExpiredAuthSessions,
  purgeExpiredLauncherSessions,
  purgeExpiredLoginCodes,
  purgeExpiredOAuthStates,
  purgeOldDraftProjects,
  purgeOldDraftPosts,
  pruneOldEventLogs
} from "../jobs/retention.js";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const jobArg = args.find((a) => a.startsWith("--job="));
const specificJob = jobArg?.split("=")[1];

async function showStats() {
  console.log("\n=== Current Database Stats ===\n");

  const now = new Date();

  // Auth sessions
  const authTotal = await prisma.authSession.count();
  const authExpired = await prisma.authSession.count({
    where: { expiresAt: { lt: now } }
  });
  const authRevoked = await prisma.authSession.count({
    where: { revokedAt: { not: null } }
  });
  console.log(`AuthSessions: ${authTotal} total (${authExpired} expired, ${authRevoked} revoked)`);

  // Launcher sessions
  const launcherTotal = await prisma.launcherSession.count();
  const launcherExpired = await prisma.launcherSession.count({
    where: { expiresAt: { lt: now } }
  });
  console.log(`LauncherSessions: ${launcherTotal} total (${launcherExpired} expired)`);

  // Login codes
  const codeTotal = await prisma.launcherLoginCode.count();
  const codeExpired = await prisma.launcherLoginCode.count({
    where: { expiresAt: { lt: now } }
  });
  console.log(`LauncherLoginCodes: ${codeTotal} total (${codeExpired} expired)`);

  // OAuth states
  const oauthTotal = await prisma.microsoftOAuthState.count();
  const oauthExpired = await prisma.microsoftOAuthState.count({
    where: { expiresAt: { lt: now } }
  });
  console.log(`MicrosoftOAuthStates: ${oauthTotal} total (${oauthExpired} expired)`);

  // Draft projects
  const projectDrafts = await prisma.project.count({
    where: { status: "DRAFT" }
  });
  console.log(`Draft Projects: ${projectDrafts}`);

  // Draft posts
  const postDrafts = await prisma.post.count({
    where: { status: "DRAFT" }
  });
  console.log(`Draft Posts: ${postDrafts}`);

  // Event logs
  const eventTotal = await prisma.eventLog.count();
  console.log(`EventLog entries: ${eventTotal}`);

  console.log("");
}

async function main() {
  const startTime = new Date();
  console.log(JSON.stringify({
    event: "retention.job.start",
    timestamp: startTime.toISOString(),
    dryRun: isDryRun,
    specificJob: specificJob || null
  }));

  console.log("=== PrismMTR Retention Jobs ===\n");

  if (isDryRun) {
    console.log("DRY RUN MODE - No data will be deleted\n");
    await showStats();
    await prisma.$disconnect();
    console.log(JSON.stringify({
      event: "retention.job.end",
      timestamp: new Date().toISOString(),
      status: "success",
      dryRun: true,
      durationMs: Date.now() - startTime.getTime()
    }));
    process.exit(0);
  }

  let hasErrors = false;

  if (specificJob) {
    console.log(`Running specific job: ${specificJob}\n`);

    const jobs: Record<string, () => Promise<number>> = {
      authSessions: purgeExpiredAuthSessions,
      launcherSessions: purgeExpiredLauncherSessions,
      loginCodes: purgeExpiredLoginCodes,
      oauthStates: purgeExpiredOAuthStates,
      draftProjects: purgeOldDraftProjects,
      draftPosts: purgeOldDraftPosts,
      eventLogs: pruneOldEventLogs
    };

    const jobFn = jobs[specificJob];
    if (!jobFn) {
      console.error(`Unknown job: ${specificJob}`);
      console.log("Available jobs:", Object.keys(jobs).join(", "));
      console.log(JSON.stringify({
        event: "retention.job.end",
        timestamp: new Date().toISOString(),
        status: "error",
        error: `Unknown job: ${specificJob}`,
        durationMs: Date.now() - startTime.getTime()
      }));
      process.exit(1);
    }

    try {
      const count = await jobFn();
      console.log(`\nDeleted: ${count} records`);
    } catch (error) {
      console.error("Job failed:", error);
      hasErrors = true;
    }
  } else {
    // Run all jobs
    const results = await runAllRetentionJobs();

    console.log("\n=== Results ===");
    console.log(`Auth Sessions:     ${results.authSessions}`);
    console.log(`Launcher Sessions: ${results.launcherSessions}`);
    console.log(`Login Codes:       ${results.loginCodes}`);
    console.log(`OAuth States:      ${results.oauthStates}`);
    console.log(`Draft Projects:    ${results.draftProjects}`);
    console.log(`Draft Posts:       ${results.draftPosts}`);
    console.log(`Event Logs:        ${results.eventLogs}`);
    console.log(`─────────────────────────────`);
    console.log(`Total Deleted:     ${results.totalDeleted}`);

    if (results.errors.length > 0) {
      console.log("\nErrors:");
      results.errors.forEach((e) => console.log(`  - ${e}`));
      hasErrors = true;
    }
  }

  await prisma.$disconnect();

  // Final status log for monitoring
  console.log(JSON.stringify({
    event: "retention.job.end",
    timestamp: new Date().toISOString(),
    status: hasErrors ? "partial_failure" : "success",
    durationMs: Date.now() - startTime.getTime()
  }));

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  console.log(JSON.stringify({
    event: "retention.job.end",
    timestamp: new Date().toISOString(),
    status: "fatal_error",
    error: err instanceof Error ? err.message : "Unknown error"
  }));
  process.exit(1);
});
