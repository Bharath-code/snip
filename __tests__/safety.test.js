const safety = require('../lib/safety');

test('detects rm -rf', () => {
  expect(safety.isDangerous('rm -rf /tmp/foo')).toBe(true);
});

test('allows harmless content', () => {
  expect(safety.isDangerous('echo hello')).toBe(false);
});
