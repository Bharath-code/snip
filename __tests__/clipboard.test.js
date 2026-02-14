const clipboard = require('../lib/clipboard');

describe('clipboard', () => {
  test('uses pbcopy on macOS', () => {
    const calls = [];
    const runner = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0 };
    };

    const result = clipboard.copyText('hello', 'darwin', runner);

    expect(result.ok).toBe(true);
    expect(result.command).toBe('pbcopy');
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('pbcopy');
    expect(calls[0].opts.input).toBe('hello');
  });

  test('falls back to next command on Linux', () => {
    const calls = [];
    const runner = (cmd) => {
      calls.push(cmd);
      if (cmd === 'wl-copy') return { status: 1 };
      if (cmd === 'xclip') return { status: 0 };
      return { status: 1 };
    };

    const result = clipboard.copyText('value', 'linux', runner);

    expect(result.ok).toBe(true);
    expect(result.command).toBe('xclip');
    expect(calls).toEqual(['wl-copy', 'xclip']);
  });

  test('returns failure when all commands fail', () => {
    const runner = () => ({ status: 1 });

    const result = clipboard.copyText('x', 'linux', runner);

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
