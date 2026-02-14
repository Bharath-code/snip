const { spawnSync } = require('child_process');

function getClipboardCommands(platform = process.platform) {
  if (platform === 'darwin') {
    return [['pbcopy', []]];
  }
  if (platform === 'win32') {
    return [['clip', []], ['powershell', ['-NoProfile', '-Command', 'Set-Clipboard']]];
  }
  return [
    ['wl-copy', []],
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']]
  ];
}

function copyText(text, platform = process.platform, runner = spawnSync) {
  const payload = String(text == null ? '' : text);
  const commands = getClipboardCommands(platform);
  let lastError = null;

  for (const [cmd, args] of commands) {
    const res = runner(cmd, args, {
      input: payload,
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'ignore']
    });
    if (!res.error && res.status === 0) {
      return { ok: true, command: cmd };
    }
    lastError = res.error || new Error(`${cmd} exited with status ${res.status}`);
  }

  return { ok: false, error: lastError };
}

module.exports = { copyText, getClipboardCommands };
