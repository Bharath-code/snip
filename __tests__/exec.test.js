const exec = require('../lib/exec');

describe('exec', () => {
  test('dry-run returns 0 and prints content', () => {
    const status = exec.runSnippetContent('echo hello', { dryRun: true });
    expect(status).toBe(0);
  });

  test('resolves language-specific runners', () => {
    expect(exec.resolveRunner('js', '/bin/sh').command).toBe('node');
    expect(exec.resolveRunner('python', '/bin/sh').command).toBe('python3');
    expect(exec.resolveRunner('unknown-lang', '/bin/zsh').command).toBe('/bin/zsh');
  });

  test('returns 127 when interpreter is missing', () => {
    const fakeRunner = () => ({ error: { code: 'ENOENT' } });
    const status = exec.runSnippetContent('print("hi")', {
      language: 'python',
      runner: fakeRunner
    });
    expect(status).toBe(127);
  });
});
