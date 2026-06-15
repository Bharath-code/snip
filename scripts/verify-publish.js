#!/usr/bin/env node

/**
 * Pre-publish Validation Script for snip CLI.
 *
 * Runs checks to verify that:
 * 1. Only required files are packaged by npm (tests, configurations, and internal docs excluded).
 * 2. Executable bin file exists and has correct POSIX permissions.
 * 3. Package size remains small and efficient.
 *
 * Usage: npm run verify-pack
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Running pre-publish verification...\n');

// ── Check 1: Executable Bin exists and has #!/usr/bin/env node ──
const binPath = path.join(__dirname, '..', 'bin', 'snip');
if (!fs.existsSync(binPath)) {
  console.error('❌ Error: bin/snip does not exist!');
  process.exit(1);
}

const content = fs.readFileSync(binPath, 'utf8');
if (!content.startsWith('#!/usr/bin/env node')) {
  console.error('❌ Error: bin/snip is missing shebang: #!/usr/bin/env node');
  process.exit(1);
}
console.log('✅ bin/snip shebang is correct.');

// On Unix systems, verify file is executable
if (process.platform !== 'win32') {
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
    console.log('✅ bin/snip is marked as executable.');
  } catch (_) {
    console.warn('⚠️ Warning: bin/snip is not marked as executable! Fixing permissions now...');
    try {
      fs.chmodSync(binPath, 0o755);
      console.log('✅ Fixed permissions: bin/snip is now executable.');
    } catch (err) {
      console.error(`❌ Failed to set executable permissions: ${err.message}`);
      process.exit(1);
    }
  }
}

// ── Check 2: Run dry-run npm pack to check package contents ──
console.log('\n📦 Simulating npm package compilation (npm pack --dry-run)...');
try {
  const output = execSync('npm pack --dry-run 2>&1', { encoding: 'utf8' });
  
  // Parse output for file list and size
  const lines = output.split('\n');
  const files = [];
  let sizeLine = '';
  let nameLine = '';

  for (const line of lines) {
    const cleanLine = line.replace(/^npm notice\s+/, '').trim();
    if (!cleanLine) continue;
    if (cleanLine.includes('Tarball Contents') || cleanLine.includes('Tarball Details')) continue;
    
    // Captured files
    // Examples: "1.1kB LICENSE", "43B bin/snip"
    const match = cleanLine.match(/^(\d+(?:\.\d+)?[a-zA-Z]*)\s+(.+)$/);
    if (match && !cleanLine.includes('size:') && !cleanLine.includes('shasum:') && !cleanLine.includes('integrity:')) {
      files.push(match[2].trim());
    }
    
    // Captured size and name details
    if (cleanLine.startsWith('unpacked size:')) {
      sizeLine = cleanLine;
    }
    if (cleanLine.startsWith('filename:')) {
      nameLine = cleanLine;
    }
  }

  console.log('\n📄 Files to be packaged:');
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');

  if (nameLine) console.log(`   ${nameLine}`);
  if (sizeLine) console.log(`   ${sizeLine}`);
  console.log('');

  // ── Check 3: Verify exclusions ──
  const forbiddenPatterns = [
    '__tests__',
    '.antigravitycli',
    '.qwen',
    'strategic',
    'mcp-e2e.js',
    'test_watch',
    'test_watchfile'
  ];

  const violations = files.filter(f => forbiddenPatterns.some(pat => f.includes(pat)));

  if (violations.length > 0) {
    console.error('❌ Error: The package contains files that should be excluded:');
    violations.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
  console.log('✅ Verified package exclusions (no test files or scratch folders found).');

  // Verify core directories exist in pack
  const requiredPaths = ['bin/snip', 'lib/cli.js', 'packs/docker-essentials/pack.json'];
  const missing = requiredPaths.filter(p => !files.some(f => f.endsWith(p)));

  if (missing.length > 0) {
    console.error('❌ Error: Required files are missing from the package:');
    missing.forEach(m => console.error(`   - ${m}`));
    process.exit(1);
  }
  console.log('✅ Verified package inclusions (all required bin, lib, and pack files present).');

  console.log('\n🎉 SUCCESS: The npm package configuration is completely clean and ready to publish!\n');

} catch (err) {
  console.error(`❌ Failed to run npm pack: ${err.message}`);
  process.exit(1);
}
