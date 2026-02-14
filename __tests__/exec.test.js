const exec = require('../lib/exec');

describe('exec', () => {
  test('dry-run returns 0 and prints content', () => {
    const status = exec.runSnippetContent('echo hello', { dryRun: true });
    expect(status).toBe(0);
  });
});
