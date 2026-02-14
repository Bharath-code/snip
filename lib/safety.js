const dangerousPatterns = [
  /rm\s+-rf\s+/i,
  /:>\s*\//, // truncate root
  /dd\s+if=.*of=\//i,
  /mkfs\./i,
  /shutdown\b|reboot\b/i,
  /:\s*\(\s*\)\s*\{\s*:\s*;\s*};/i, // fork bomb pattern
  /gpasswd\b|passwd\b/i,
  /killall\s+-9\s+/i,
  /docker\s+rm\s+-f\s+/i,
  /drop\s+table\s+/i,
  /sudo\s+rm\s+-rf\s+/i
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

module.exports = { isDangerous };
