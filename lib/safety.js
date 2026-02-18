const dangerousPatterns = [
  // Existing patterns
  /rm\s+-rf\s+/i,
  /:\>\s*\//, // truncate root
  /dd\s+if=.*of=\//i,
  /mkfs\./i,
  /shutdown\b|reboot\b/i,
  /:\s*\(\s*\)\s*\{\s*:\s*;\s*};/i, // fork bomb pattern
  /gpasswd\b|passwd\b/i,
  /killall\s+-9\s+/i,
  /docker\s+rm\s+-f\s+/i,
  /drop\s+table\s+/i,
  /sudo\s+rm\s+-rf\s+/i,

  // S1: Additional critical patterns
  /rm\s+-rf\s+[~\/]/i,                   // rm -rf / or rm -rf ~
  /chmod\s+[0-7]*7[0-7]*\s+\//i,        // chmod 777 /
  /curl\s+.*\|\s*(ba)?sh/i,             // curl | bash / sh
  /wget\s+.*\|\s*(ba)?sh/i,             // wget | bash / sh
  /eval\s*\$\s*\(/i,                    // eval $(...)
  /base64\s+(-d|--decode)\s*.*\|\s*(ba)?sh/i, // base64 -d | bash
];

function isDangerous(content) {
  if (!content) return false;
  const lines = content.split('\n');
  for (const line of lines) {
    for (const re of dangerousPatterns) {
      if (re.test(line)) return true;
    }
  }
  return false;
}

/**
 * S2: Interactive confirmation for dangerous commands.
 * Unlike --confirm flag, this always prompts the user explicitly.
 * Returns true if user confirmed, false to abort.
 */
function confirmDangerous(content) {
  const readline = require('readline-sync');
  const lines = content.split('\n').slice(0, 5).join('\n');
  console.error('\n  ╔══════════════════════════════════════════╗');
  console.error('  ║  ⚠  DANGEROUS COMMAND DETECTED           ║');
  console.error('  ╚══════════════════════════════════════════╝\n');
  console.error('  This snippet contains potentially destructive commands.');
  console.error('  Preview:\n');
  lines.split('\n').forEach(l => console.error(`    ${l}`));
  console.error('');
  const ans = readline.question('  Type "yes" to confirm execution (anything else aborts): ');
  return ans.trim().toLowerCase() === 'yes';
}

module.exports = { isDangerous, confirmDangerous };
