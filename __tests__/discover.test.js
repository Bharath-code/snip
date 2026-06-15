/**
 * Tests for the snip discover command.
 *
 * These tests mock the GitHub API layer (gist.searchCodeGists, gist.listRecentGists)
 * and verify the command's output formatting, error handling, and edge cases.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the gist module
const mockSearchCodeGists = jest.fn();
const mockListRecentGists = jest.fn();

jest.mock('../lib/sync/gist', () => ({
  searchCodeGists: mockSearchCodeGists,
  listRecentGists: mockListRecentGists,
  shareSnippet: jest.fn(),
  sharePack: jest.fn(),
  deleteGist: jest.fn(),
  createGist: jest.fn(),
  snippetToFile: jest.fn(),
  pushSnippet: jest.fn(),
  pullGist: jest.fn(),
}));

// Mock config to return a token
jest.mock('../lib/config', () => {
  let tokenValue = 'test-token';
  return {
    loadConfig: jest.fn(() => ({
      gist_token: tokenValue,
      dbPath: '/tmp/snip-discover-test/db.json',
      dataDir: '/tmp/snip-discover-test/data',
    })),
    _setToken: (v) => { tokenValue = v; },
  };
});

describe('discover command', () => {
  let discoverCmd;
  const originalEnv = process.env;
  let logs, errors;

  beforeEach(() => {
    const mockConfig = require('../lib/config');
    mockConfig._setToken('test-token');

    // Clear mocks
    mockSearchCodeGists.mockReset();
    mockListRecentGists.mockReset();

    // Capture console.log and console.error
    logs = [];
    errors = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    // Re-import to get fresh module state
    jest.isolateModules(() => {
      discoverCmd = require('../lib/commands/discover');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  test('should require query or --recent', async () => {
    await discoverCmd(null, {});
    const errOutput = errors.join('\n');
    expect(errOutput).toContain('Search query is required');
  });

  test('should require token for search', async () => {
    const mockConfig = require('../lib/config');
    mockConfig._setToken(null);

    await discoverCmd('docker health', {});
    const errOutput = errors.join('\n');
    expect(errOutput).toContain('GitHub token not configured');
  });

  test('should search gists and display results', async () => {
    mockSearchCodeGists.mockResolvedValue({
      total_count: 2,
      items: [
        {
          name: 'health_check.sh',
          path: 'health_check.sh',
          html_url: 'https://gist.github.com/abc123#file-health_check-sh',
          repository: { full_name: 'gist/abc123' },
          score: 1.0,
        },
        {
          name: 'deploy.sh',
          path: 'deploy.sh',
          html_url: 'https://gist.github.com/def456#file-deploy-sh',
          repository: { full_name: 'gist/def456' },
          score: 0.8,
        },
      ],
    });

    await discoverCmd('docker health', {});
    const output = logs.join('\n');

    expect(mockSearchCodeGists).toHaveBeenCalledWith(
      'docker health',
      'test-token',
      expect.objectContaining({})
    );
    expect(output).toContain('2 results');
    expect(output).toContain('health_check.sh');
    expect(output).toContain('deploy.sh');
  });

  test('should return JSON output for search', async () => {
    mockSearchCodeGists.mockResolvedValue({
      total_count: 1,
      items: [
        {
          name: 'backup.py',
          path: 'backup.py',
          html_url: 'https://gist.github.com/abc123def456#file-backup-py',
          repository: { full_name: 'gist/abc123def456' },
          score: 0.9,
        },
      ],
    });

    await discoverCmd('backup', { json: true });

    // Find the JSON output (skip decorative lines)
    const jsonLine = logs.find(l => l.startsWith('{'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine);
    expect(parsed.total_count).toBe(1);
    expect(parsed.items[0].name).toBe('backup.py');
    expect(parsed.items[0].gistId).toBe('abc123def456');
  });

  test('should handle empty search results', async () => {
    mockSearchCodeGists.mockResolvedValue({
      total_count: 0,
      items: [],
    });

    await discoverCmd('nonexistent_query', {});
    const output = logs.join('\n');
    expect(output).toContain('No results found');
  });

  test('should browse recent public gists', async () => {
    mockListRecentGists.mockResolvedValue([
      {
        id: 'abc123',
        description: 'snip: health-check',
        html_url: 'https://gist.github.com/abc123',
        files: { 'health_check.sh': { filename: 'health_check.sh' } },
        owner: { login: 'testuser' },
        created_at: '2025-06-01T00:00:00Z',
      },
      {
        id: 'def456',
        description: 'My random gist',
        html_url: 'https://gist.github.com/def456',
        files: { 'notes.txt': { filename: 'notes.txt' } },
        owner: { login: 'anotheruser' },
        created_at: '2025-05-01T00:00:00Z',
      },
    ]);

    await discoverCmd(null, { recent: true });
    const output = logs.join('\n');

    expect(mockListRecentGists).toHaveBeenCalled();
    expect(output).toContain('Recent Public Gists');
    expect(output).toContain('abc123');
    expect(output).toContain('snip: health-check');
  });

  test('should filter recent gists with --snip-only', async () => {
    mockListRecentGists.mockResolvedValue([
      {
        id: 'abc123',
        description: 'snip: health-check',
        html_url: 'https://gist.github.com/abc123',
        files: { 'health_check.sh': { filename: 'health_check.sh' } },
        owner: { login: 'testuser' },
        created_at: '2025-06-01T00:00:00Z',
      },
      {
        id: 'def456',
        description: 'My random gist',
        html_url: 'https://gist.github.com/def456',
        files: { 'notes.txt': { filename: 'notes.txt' } },
        owner: { login: 'anotheruser' },
        created_at: '2025-05-01T00:00:00Z',
      },
    ]);

    await discoverCmd(null, { recent: true, snipOnly: true });
    const output = logs.join('\n');

    expect(output).toContain('snip-shared Gists');
    expect(output).toContain('health-check');
    expect(output).not.toContain('My random gist');
  });

  test('should handle API errors gracefully', async () => {
    mockSearchCodeGists.mockRejectedValue(new Error('Rate limit exceeded'));

    await discoverCmd('test', {});
    const errOutput = errors.join('\n');
    expect(errOutput).toContain('Rate limit exceeded');
  });

  test('should pass lang filter to search', async () => {
    mockSearchCodeGists.mockResolvedValue({
      total_count: 0,
      items: [],
    });

    await discoverCmd('deploy', { lang: 'python' });

    expect(mockSearchCodeGists).toHaveBeenCalledWith(
      'deploy',
      'test-token',
      expect.objectContaining({ lang: 'python' })
    );
  });
});
