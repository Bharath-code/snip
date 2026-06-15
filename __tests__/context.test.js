const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock spawnSync for git operations
const mockSpawnSync = jest.fn();
jest.mock('child_process', () => ({
  spawnSync: mockSpawnSync,
}));

const context = require('../lib/context');

describe('context detection', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-ctx-test-'));
    mockSpawnSync.mockReset();
    // By default, git commands fail (non-git directory)
    mockSpawnSync.mockReturnValue({ status: 1, stdout: '' });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function createFile(name) {
    fs.writeFileSync(path.join(testDir, name), '', 'utf8');
  }

  test('detects no context in empty directory', () => {
    const ctx = context.detectContext(testDir);
    expect(ctx.projectType).toBe('unknown');
    expect(ctx.tags).toEqual([]);
    expect(ctx.files).toEqual([]);
  });

  test('detects Node.js project from package.json', () => {
    createFile('package.json');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('node');
    expect(ctx.tags).toContain('npm');
    expect(ctx.files).toContain('package.json');
  });

  test('detects Docker project from Dockerfile', () => {
    createFile('Dockerfile');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('docker');
  });

  test('detects multiple signals and deduplicates tags', () => {
    createFile('package.json');
    createFile('Dockerfile');
    createFile('tsconfig.json');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('node');
    expect(ctx.tags).toContain('docker');
    expect(ctx.tags).toContain('typescript');
    expect(ctx.files.length).toBe(3);
  });

  test('detects Terraform from .tf files', () => {
    createFile('main.tf');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('terraform');
  });

  test('detects Go from go.mod', () => {
    createFile('go.mod');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('go');
  });

  test('detects Python from requirements.txt', () => {
    createFile('requirements.txt');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('python');
  });

  test('detects Rust from Cargo.toml', () => {
    createFile('Cargo.toml');
    const ctx = context.detectContext(testDir);
    expect(ctx.tags).toContain('rust');
  });

  test('returns directory name as project name when no git', () => {
    const dirName = path.basename(testDir);
    const ctx = context.detectContext(testDir);
    expect(ctx.projectName).toBe(dirName);
    expect(ctx.gitRemote).toBeNull();
  });

  test('returns git remote info when available', () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: 'git@github.com:user/my-project.git\n' }) // git remote
      .mockReturnValueOnce({ status: 0, stdout: 'main\n' }); // git branch

    const ctx = context.detectContext(testDir);
    expect(ctx.gitRemote).not.toBeNull();
    expect(ctx.gitRemote.org).toBe('user');
    expect(ctx.gitRemote.repo).toBe('my-project');
    expect(ctx.projectName).toBe('my-project');
    expect(ctx.branch).toBe('main');
  });
});

describe('scoreRelevance', () => {
  const baseSnippet = { name: 'test', language: 'sh', tags: [], usageCount: 0 };

  function snippet(overrides) {
    return { ...baseSnippet, ...overrides };
  }

  function contextWithTags(tags, projectName = 'myproject') {
    return { tags, projectName, files: [], signals: [], gitRemote: null, branch: null, projectType: tags[0] || 'unknown' };
  }

  test('returns 0 for no matches', () => {
    const ctx = contextWithTags(['docker']);
    const score = context.scoreRelevance(snippet({ tags: ['node'] }), ctx);
    expect(score).toBe(0);
  });

  test('scores tag match at 25', () => {
    const ctx = contextWithTags(['docker']);
    const score = context.scoreRelevance(snippet({ tags: ['docker'] }), ctx);
    expect(score).toBeGreaterThanOrEqual(25);
  });

  test('scores language match at 20', () => {
    const ctx = contextWithTags(['python']);
    const score = context.scoreRelevance(snippet({ language: 'python', tags: [] }), ctx);
    expect(score).toBeGreaterThanOrEqual(20);
  });

  test('scores multiple matches cumulatively', () => {
    const ctx = contextWithTags(['docker', 'node', 'npm']);
    const score = context.scoreRelevance(snippet({ name: 'docker-deploy', tags: ['docker', 'npm'], usageCount: 3 }), ctx);
    // tag:docker=25, tag:npm=25, name-contains-docker=10, usage=15 = 75
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('caps score at 100', () => {
    const ctx = contextWithTags(['docker', 'node', 'npm', 'k8s']);
    const score = context.scoreRelevance(snippet({
      name: 'docker-node-k8s',
      tags: ['docker', 'node', 'npm', 'k8s'],
      language: 'javascript',
      usageCount: 10,
      lastUsedAt: new Date().toISOString(),
    }), ctx);
    expect(score).toBe(100);
  });
});
