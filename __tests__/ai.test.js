const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the OpenAI API
jest.mock('../lib/ai/openai', () => ({
  generate: jest.fn().mockResolvedValue('console.log("Hello World");\n')
}));

describe('AI Command', () => {
  const originalEnv = process.env;
  const testDir = path.join(os.tmpdir(), 'snip-ai-test');
  const testConfig = {
    dbPath: path.join(testDir, 'db.json')
  };

  beforeEach(() => {
    // Reset env and create test directory
    process.env = { ...originalEnv };
    fs.mkdirSync(testDir, { recursive: true });

    // Mock config loader
    jest.doMock('../lib/config', () => ({
      loadConfig: jest.fn(() => ({
        ...testConfig,
        ai_model: 'gpt-3.5-turbo',
        ai_max_tokens: 1000,
        ai_provider: 'openai'
      })),
      CONFIG_FILE: path.join(testDir, 'config.json')
    }));
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    process.env = originalEnv;
    jest.resetModules();
  });

  test('should generate snippet successfully', async () => {
    // Set API key
    process.env.SNIP_AI_API_KEY = 'sk-test-key';

    // Import and run AI command
    const ai = require('../lib/commands/ai');

    // Mock console.log and process.exit to capture output
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await ai.generate('console hello world', {});

    // Restore console
    console.log = originalLog;
    mockExit.mockRestore();

    // Check output
    const output = logs.join('\n');
    expect(output).toContain('✓ Generated:');
    expect(output).toContain('🤖');
  });

  test('should require API key', async () => {
    // Don't set API key
    const ai = require('../lib/commands/ai');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    await ai.generate('test', {});

    console.error = originalError;
    mockExit.mockRestore();

    const errorOutput = errors.join('\n');
    expect(errorOutput).toContain('API key not configured');
  });

  test('should auto-detect language', async () => {
    process.env.SNIP_AI_API_KEY = 'sk-test-key';

    // Mock OpenAI to return Python code
    const openai = require('../lib/ai/openai');
    openai.generate.mockResolvedValue('def hello():\n    print("Hello World")');

    // Mock detect language
    jest.doMock('../lib/ai/detect', () => jest.fn(() => 'python'));

    const ai = require('../lib/commands/ai');
    const storage = require('../lib/storage');

    // Spy on storage.addSnippet
    const addSpy = jest.spyOn(storage, 'addSnippet');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await ai.generate('python hello function', {});

    mockExit.mockRestore();

    // Check that Python was detected
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'python',
        tags: expect.arrayContaining(['ai-generated'])
      })
    );
  });

  test('should handle API errors gracefully', async () => {
    process.env.SNIP_AI_API_KEY = 'sk-invalid-key';

    // Mock API to throw error
    const openai = require('../lib/ai/openai');
    openai.generate.mockRejectedValue(new Error('Invalid API key'));

    const ai = require('../lib/commands/ai');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    await ai.generate('test', {});

    console.error = originalError;
    mockExit.mockRestore();

    const errorOutput = errors.join('\n');
    expect(errorOutput).toContain('Invalid API key');
  });
});

describe('Language Detection', () => {
  const detectLanguage = require('../lib/ai/detect');

  test('should detect shebang languages', () => {
    const jsCode = '#!/usr/bin/env node\nconsole.log("test");';
    expect(detectLanguage(jsCode)).toBe('js');

    const pythonCode = '#!/usr/bin/env python\nprint("test");';
    expect(detectLanguage(pythonCode)).toBe('python');

    const bashCode = '#!/bin/bash\necho "test"';
    expect(detectLanguage(bashCode)).toBe('bash');
  });

  test('should detect syntax patterns', () => {
    const jsCode = 'const x = 1;\nfunction hello() {}';
    expect(detectLanguage(jsCode)).toBe('js');

    const pythonCode = 'import os\ndef test():\n    pass';
    expect(detectLanguage(pythonCode)).toBe('python');

    const sqlCode = 'SELECT * FROM users WHERE id = 1';
    expect(detectLanguage(sqlCode)).toBe('sql');
  });

  test('should detect from prompt', () => {
    expect(detectLanguage('', 'create a python script')).toBe('python');
    expect(detectLanguage('', 'javascript function')).toBe('js');
    expect(detectLanguage('', 'docker container')).toBe('dockerfile');
  });

  test('should default to text', () => {
    expect(detectLanguage('random text', 'some prompt')).toBe('text');
  });
});

// Note: OpenAI provider tests are complex to mock properly due to the rate limiting
// and retry logic. These would require more extensive mocking of fetch, timing,
// and the internal state. For now, integration tests with a real API key are
// recommended for full coverage of the provider functionality.