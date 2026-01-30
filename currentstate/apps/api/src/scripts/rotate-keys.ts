#!/usr/bin/env npx tsx

/**
 * CLI Script: Rotate Encryption Keys
 *
 * Usage:
 *   npx tsx src/scripts/rotate-keys.ts status        # Show current key status
 *   npx tsx src/scripts/rotate-keys.ts check         # Validate key configuration
 *   npx tsx src/scripts/rotate-keys.ts rotate        # Rotate all keys to current version
 *   npx tsx src/scripts/rotate-keys.ts rotate --from=1  # Rotate only V1 keys
 *
 * Key Rotation Process:
 *   1. Add new key to env: MICROSOFT_TOKEN_KEY_V2=<64-hex-chars>
 *   2. Update MICROSOFT_TOKEN_CURRENT_VERSION=2
 *   3. Run: npx tsx src/scripts/rotate-keys.ts rotate
 *   4. After successful rotation, you can remove the old key (optional)
 */

import "dotenv/config";
import { prisma } from "@prismmtr/db";
import {
  validateKeyConfiguration,
  getAvailableKeyVersions,
  getCurrentKeyVersion,
  rotateAllKeys
} from "../services/key-management.js";

const args = process.argv.slice(2);
const command = args[0] || "status";
const fromVersionArg = args.find((a) => a.startsWith("--from="));
const fromVersion = fromVersionArg ? parseInt(fromVersionArg.split("=")[1], 10) : undefined;

async function showStatus() {
  console.log("=== Key Management Status ===\n");

  const availableVersions = getAvailableKeyVersions();
  const currentVersion = getCurrentKeyVersion();

  console.log(`Available key versions: ${availableVersions.join(", ") || "None"}`);
  console.log(`Current version for new encryptions: V${currentVersion}`);
  console.log("");

  // Show count of tokens per version
  const versionCounts = await prisma.microsoftLink.groupBy({
    by: ["keyVersion"],
    _count: true
  });

  if (versionCounts.length === 0) {
    console.log("No Microsoft links in database.");
  } else {
    console.log("Tokens by key version:");
    for (const vc of versionCounts) {
      const marker = vc.keyVersion === currentVersion ? " (current)" : "";
      console.log(`  V${vc.keyVersion}: ${vc._count} tokens${marker}`);
    }

    const needsRotation = versionCounts.filter((vc) => vc.keyVersion !== currentVersion);
    if (needsRotation.length > 0) {
      const total = needsRotation.reduce((sum, vc) => sum + vc._count, 0);
      console.log(`\n${total} token(s) need rotation to V${currentVersion}`);
    } else {
      console.log("\nAll tokens are on the current version.");
    }
  }
}

async function checkConfiguration() {
  console.log("=== Validating Key Configuration ===\n");

  const result = validateKeyConfiguration();

  if (result.errors.length > 0) {
    console.log("ERRORS:");
    result.errors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("\nWARNINGS:");
    result.warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  }

  if (result.valid) {
    console.log("\n✅ Key configuration is valid.");
  } else {
    console.log("\n❌ Key configuration has errors. Fix them before proceeding.");
    process.exit(1);
  }
}

async function rotateKeys() {
  console.log("=== Rotating Encryption Keys ===\n");

  // Validate first
  const validation = validateKeyConfiguration();
  if (!validation.valid) {
    console.error("Key configuration is invalid. Run 'check' command for details.");
    process.exit(1);
  }

  const currentVersion = getCurrentKeyVersion();

  if (fromVersion !== undefined) {
    console.log(`Rotating keys from V${fromVersion} to V${currentVersion}...`);
  } else {
    console.log(`Rotating all keys to V${currentVersion}...`);
  }
  console.log("");

  const results = await rotateAllKeys(prisma, fromVersion);

  console.log(`Total links processed: ${results.total}`);
  console.log(`Successfully rotated:  ${results.rotated}`);
  console.log(`Failed:                ${results.failed}`);

  if (results.failed > 0) {
    console.log("\nFailed rotations:");
    results.results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - User ${r.userId}: ${r.error}`);
      });
    process.exit(1);
  }

  if (results.rotated === 0 && results.total > 0) {
    console.log("\nNo keys needed rotation (all already on current version).");
  } else if (results.rotated > 0) {
    console.log("\n✅ Key rotation completed successfully.");
  }
}

async function main() {
  switch (command) {
    case "status":
      await showStatus();
      break;

    case "check":
      await checkConfiguration();
      break;

    case "rotate":
      await rotateKeys();
      break;

    default:
      console.log("Usage: npx tsx src/scripts/rotate-keys.ts <command>");
      console.log("");
      console.log("Commands:");
      console.log("  status    Show current key status");
      console.log("  check     Validate key configuration");
      console.log("  rotate    Rotate all keys to current version");
      console.log("");
      console.log("Options:");
      console.log("  --from=N  Only rotate keys from version N");
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
