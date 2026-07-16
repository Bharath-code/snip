const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { setExitCode } = require('../cli-utils');

const SERVER_ENTRY = { command: 'snip', args: ['mcp'] };

const MANUAL_SNIPPET = JSON.stringify({ mcpServers: { snip: SERVER_ENTRY } }, null, 2);

function mergeJsonConfig(configPath) {
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      throw new Error(`${configPath} exists but is not valid JSON (${e.message}). Add this manually:\n${MANUAL_SNIPPET}`);
    }
  }
  cfg.mcpServers = cfg.mcpServers || {};
  if (cfg.mcpServers.snip && JSON.stringify(cfg.mcpServers.snip) === JSON.stringify(SERVER_ENTRY)) {
    return { path: configPath, changed: false };
  }
  cfg.mcpServers.snip = SERVER_ENTRY;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n');
  return { path: configPath, changed: true };
}

function installClaude() {
  const res = spawnSync('claude', ['mcp', 'add', '--scope', 'user', 'snip', '--', 'snip', 'mcp'], { stdio: 'inherit' });
  if (res.error && res.error.code === 'ENOENT') {
    console.log('Claude Code CLI not found. Add snip manually to ~/.claude.json under "mcpServers":');
    console.log(MANUAL_SNIPPET);
    return false;
  }
  return res.status === 0;
}

const CLIENTS = {
  claude: {
    label: 'Claude Code',
    install: installClaude,
  },
  cursor: {
    label: 'Cursor',
    install: () => {
      const { path: p, changed } = mergeJsonConfig(path.join(os.homedir(), '.cursor', 'mcp.json'));
      console.log(changed ? `Added snip to ${p}` : `snip already configured in ${p}`);
      return true;
    },
  },
  goose: {
    label: 'Goose',
    install: () => {
      console.log('Add this to ~/.config/goose/config.yaml under "extensions":\n');
      console.log('  snip:\n    enabled: true\n    type: stdio\n    cmd: snip\n    args: ["mcp"]');
      return true;
    },
  },
  continue: {
    label: 'Continue',
    install: () => {
      console.log('Add this to ~/.continue/config.json under "experimental.modelContextProtocolServers":\n');
      console.log(JSON.stringify({ transport: { type: 'stdio', ...SERVER_ENTRY } }, null, 2));
      return true;
    },
  },
};

function mcpInstallCmd(client) {
  const key = String(client || '').toLowerCase();
  if (!CLIENTS[key]) {
    console.error(`Unknown client "${client}". Supported: ${Object.keys(CLIENTS).join(', ')}`);
    console.error(`\nGeneric MCP config for any client:\n${MANUAL_SNIPPET}`);
    setExitCode(1);
    return;
  }
  console.log(`Configuring snip MCP server for ${CLIENTS[key].label}...`);
  try {
    const ok = CLIENTS[key].install();
    if (ok) {
      console.log(`\nDone. Restart ${CLIENTS[key].label}, then your agent can use snip_search, snip_read, snip_exec (dry-run by default) and more.`);
    } else {
      setExitCode(1);
    }
  } catch (e) {
    console.error(e.message);
    setExitCode(1);
  }
}

module.exports = { mcpInstallCmd, mergeJsonConfig, CLIENTS };
