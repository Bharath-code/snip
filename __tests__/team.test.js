const fs = require('fs');
const path = require('path');
const os = require('os');

describe('team module', () => {
  let testDir;
  let configDir;
  let dataDir;
  let teamDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-team-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    configDir = path.join(testDir, 'config');
    dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = configDir;
    process.env.XDG_DATA_HOME = dataDir;
    jest.resetModules();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function freshTeam() {
    return require('../lib/team');
  }

  test('detectTeamDir returns null when no .snip/ exists', () => {
    const team = freshTeam();
    const result = team.detectTeamDir(testDir);
    expect(result).toBeNull();
  });

  test('initTeamDir creates .snip/ with snippets.json', () => {
    const team = freshTeam();
    const result = team.initTeamDir(testDir, 'my-project');
    expect(result.workspace).toBe('my-project');

    const teamFilePath = path.join(testDir, '.snip', 'snippets.json');
    expect(fs.existsSync(teamFilePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(teamFilePath, 'utf8'));
    expect(data.workspace).toBe('my-project');
    expect(data.snippets).toEqual([]);
  });

  test('initTeamDir scaffolds policy.json and README.md stubs', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'my-project');

    const policyPath = path.join(testDir, '.snip', 'policy.json');
    expect(fs.existsSync(policyPath)).toBe(true);
    const pol = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(pol.execRequiresApproval).toBe(false);
    expect(pol.deny).toEqual([]);

    const readmePath = path.join(testDir, '.snip', 'README.md');
    expect(fs.readFileSync(readmePath, 'utf8')).toContain('my-project runbook');
  });

  test('initTeamDir does not overwrite existing policy.json', () => {
    const team = freshTeam();
    const snipDir = path.join(testDir, '.snip');
    fs.mkdirSync(snipDir, { recursive: true });
    fs.writeFileSync(path.join(snipDir, 'policy.json'), '{"deny":["custom"]}');
    team.initTeamDir(testDir, 'my-project');
    const pol = JSON.parse(fs.readFileSync(path.join(snipDir, 'policy.json'), 'utf8'));
    expect(pol.deny).toEqual(['custom']);
  });

  test('detectTeamDir finds .snip/ after init', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');
    const result = team.detectTeamDir(testDir);
    expect(result).toBe(path.join(testDir, '.snip'));
  });

  test('addToTeam adds snippet to team file', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl apply -f staging.yaml',
      language: 'sh',
      tags: ['k8s', 'deploy'],
    });

    const snippets = team.listTeam(testDir);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].name).toBe('deploy');
    expect(snippets[0].language).toBe('sh');
    expect(snippets[0].tags).toContain('k8s');
    expect(snippets[0].author).toBeDefined();
  });

  test('addToTeam replaces existing snippet with same name', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl apply -f staging.yaml',
      language: 'sh',
      tags: ['k8s'],
    });

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl apply -f production.yaml',
      language: 'sh',
      tags: ['k8s', 'production'],
    });

    const snippets = team.listTeam(testDir);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].content).toContain('production');
    expect(snippets[0].tags).toContain('production');
  });

  test('syncFromTeam imports snippets into local storage', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl get pods',
      language: 'sh',
      tags: ['k8s'],
    });

    // Change to testDir so detectTeamDir finds it
    const origCwd = process.cwd;
    process.cwd = () => testDir;
    try {
      const result = team.syncFromTeam();
      expect(result.imported).toBe(1);
      expect(result.workspace).toBe('test-ws');

      const storage = require('../lib/storage');
      const snippets = storage.listSnippets();
      expect(snippets).toHaveLength(1);
      expect(snippets[0].name).toBe('deploy');
      expect(snippets[0].tags).toContain('workspace:test-ws');
    } finally {
      process.cwd = origCwd;
    }
  });

  test('syncFromTeam skips already-synced snippets', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl get pods',
      language: 'sh',
      tags: ['k8s'],
    });

    // First sync
    const origCwd = process.cwd;
    process.cwd = () => testDir;
    try {
      const first = team.syncFromTeam();
      expect(first.imported).toBe(1);

      // Second sync
      const second = team.syncFromTeam();
      expect(second.imported).toBe(0); // Updated content version
    } finally {
      process.cwd = origCwd;
    }
  });

  test('getTeamMergeStatus returns diff info', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    team.addToTeam(testDir, {
      name: 'deploy',
      content: 'kubectl get pods',
      language: 'sh',
      tags: ['k8s'],
    });

    const origCwd = process.cwd;
    process.cwd = () => testDir;
    try {
      const status = team.getTeamMergeStatus();
      expect(status.workspace).toBe('test-ws');
      expect(status.inTeam).toHaveLength(1);
      expect(status.missingLocal).toHaveLength(1);
      expect(status.missingTeam).toHaveLength(0);
    } finally {
      process.cwd = origCwd;
    }
  });

  test('pushToTeam exports workspace-tagged snippets to team file', () => {
    const team = freshTeam();
    team.initTeamDir(testDir, 'test-ws');

    // Add a local snippet with workspace tag
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'local-deploy',
      content: 'echo deploying',
      language: 'sh',
      tags: ['workspace:test-ws', 'k8s'],
    });

    team.pushToTeam(testDir, { workspace: 'test-ws' });

    const snippets = team.listTeam(testDir);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].name).toBe('local-deploy');
    expect(snippets[0].tags).not.toContain('workspace:test-ws');
  });

  test('readTeamFile returns null for missing file', () => {
    const team = freshTeam();
    const result = team.readTeamFile(testDir);
    expect(result).toBeNull();
  });

  test('detectTeamDir finds .snip/ in parent directory', () => {
    const team = freshTeam();
    // Create .snip/ in testDir
    fs.mkdirSync(path.join(testDir, '.snip'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.snip', 'snippets.json'), JSON.stringify({
      workspace: 'parent-ws',
      version: 1,
      snippets: [],
    }));

    // Look from a subdirectory
    const subDir = path.join(testDir, 'src', 'components');
    fs.mkdirSync(subDir, { recursive: true });

    const origCwd = process.cwd;
    process.cwd = () => subDir;
    try {
      const result = team.detectTeamDir();
      expect(result).toBe(path.join(testDir, '.snip'));
    } finally {
      process.cwd = origCwd;
    }
  });
});
