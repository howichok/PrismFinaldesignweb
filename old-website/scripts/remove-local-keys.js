/**
 * PrismMTR - Secure Local Keys Deletion Script
 * 
 * This script safely removes the local-keys.env file and logs the deletion.
 * Run with: npm run remove-local-keys
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOCAL_KEYS_FILE = path.join(__dirname, 'local-keys.env');
const LOG_FILE = path.join(__dirname, '.local-keys-deletion.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, logEntry);
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PrismMTR - Secure Local Keys Deletion');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Check if file exists
  if (!fs.existsSync(LOCAL_KEYS_FILE)) {
    log('✓ No local-keys.env file found. Nothing to delete.');
    console.log('');
    process.exit(0);
  }

  // Show file info
  const stats = fs.statSync(LOCAL_KEYS_FILE);
  console.log(`Found: ${LOCAL_KEYS_FILE}`);
  console.log(`Size: ${stats.size} bytes`);
  console.log(`Modified: ${stats.mtime.toISOString()}`);
  console.log('');

  // Confirm deletion
  const confirmed = await confirm('⚠️  Are you sure you want to DELETE local-keys.env? (y/N): ');

  if (!confirmed) {
    log('✗ Deletion cancelled by user.');
    console.log('');
    process.exit(0);
  }

  try {
    // Securely overwrite the file with zeros before deletion
    const size = stats.size;
    const zeros = Buffer.alloc(size, 0);
    fs.writeFileSync(LOCAL_KEYS_FILE, zeros);

    // Now delete the file
    fs.unlinkSync(LOCAL_KEYS_FILE);

    log('✓ local-keys.env has been securely deleted.');
    log(`  - File was overwritten with ${size} zero bytes before deletion`);
    log(`  - Deletion logged to: ${LOG_FILE}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✓ SECURE DELETION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    log(`✗ Error deleting file: ${error.message}`);
    console.error('');
    process.exit(1);
  }
}

main();
