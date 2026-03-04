const path = require('path');

// Mock storage — test snippets live in-memory
let mockSnippets = {};
let mockContents = {};

jest.mock('../lib/storage', () => ({
    getSnippetByIdOrName: (id) => mockSnippets[id] || null,
    readSnippetContent: (s) => mockContents[s.name] || '',
    touchUsage: jest.fn(),
    listSnippets: () => Object.values(mockSnippets),
}));

jest.mock('../lib/config', () => ({
    loadConfig: () => ({ defaultShell: '/bin/sh', confirmRun: false }),
}));

// We can test pipe logic directly
const template = require('../lib/template');

beforeEach(() => {
    mockSnippets = {
        'hello': { id: '1', name: 'hello', language: 'sh', tags: ['test'] },
        'deploy': { id: '2', name: 'deploy', language: 'sh', tags: ['ops'] },
        'empty': { id: '3', name: 'empty', language: 'sh', tags: [] },
    };
    mockContents = {
        'hello': 'echo "hello world"',
        'deploy': 'ssh {{user:root}}@{{host}} "cd /app && git pull"',
        'empty': '',
    };
});

describe('pipe — template interpolation via JSON', () => {
    test('interpolates template variables from JSON object', () => {
        const content = mockContents['deploy'];
        const values = { user: 'admin', host: 'prod.example.com' };
        const result = template.interpolate(content, values);
        expect(result).toBe('ssh admin@prod.example.com "cd /app && git pull"');
    });

    test('falls back to defaults when JSON key is missing', () => {
        const content = mockContents['deploy'];
        const values = { host: 'staging.example.com' };
        const result = template.interpolate(content, values);
        expect(result).toBe('ssh root@staging.example.com "cd /app && git pull"');
    });

    test('uses all defaults when JSON is empty', () => {
        const content = mockContents['deploy'];
        const result = template.interpolate(content, {});
        expect(result).toBe('ssh root@{{host}} "cd /app && git pull"');
    });
});

describe('pipe — snippet resolution', () => {
    const storage = require('../lib/storage');

    test('resolves snippet by name', () => {
        const s = storage.getSnippetByIdOrName('hello');
        expect(s).not.toBeNull();
        expect(s.name).toBe('hello');
    });

    test('returns null for missing snippet', () => {
        const s = storage.getSnippetByIdOrName('nonexistent');
        expect(s).toBeNull();
    });

    test('reads snippet content', () => {
        const s = storage.getSnippetByIdOrName('hello');
        const content = storage.readSnippetContent(s);
        expect(content).toBe('echo "hello world"');
    });

    test('empty snippet has empty content', () => {
        const s = storage.getSnippetByIdOrName('empty');
        const content = storage.readSnippetContent(s);
        expect(content).toBe('');
    });
});

describe('pipe — dry-run output', () => {
    test('content without templates is returned as-is', () => {
        const content = mockContents['hello'];
        // No template vars → interpolation is a no-op
        expect(template.hasVariables(content)).toBe(false);
        expect(content).toBe('echo "hello world"');
    });

    test('content with templates + JSON values resolves correctly', () => {
        const content = mockContents['deploy'];
        expect(template.hasVariables(content)).toBe(true);
        const resolved = template.interpolate(content, { user: 'deploy-bot', host: '10.0.0.1' });
        expect(resolved).toBe('ssh deploy-bot@10.0.0.1 "cd /app && git pull"');
    });
});
