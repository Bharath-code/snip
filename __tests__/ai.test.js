const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the OpenAI module
const mockOpenAIGenerate = jest.fn();
jest.mock('../lib/ai/openai', () => ({
  generate: mockOpenAIGenerate
}));

describe('AI Command', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-ai-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    // Set up test config and data paths
    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    
    process.env = { 
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
      SNIP_AI_API_KEY: 'sk-test-key'
    };

    // Reset module cache and mock
    jest.resetModules();
    mockOpenAIGenerate.mockReset();
    mockOpenAIGenerate.mockResolvedValue('console.log("Hello World");\n');
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('should generate snippet successfully', async () => {
    const ai = require('../lib/commands/ai');

    // Mock console.log to capture output
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await ai.generate('console hello world', {});

    // Restore mocks
    spyLog.mockRestore();
    mockExit.mockRestore();

    // Check output contains success message
    const output = logs.join('\n');
    expect(output).toContain('Generated:');
    expect(output).toContain('🤖');
  });

  test('should require API key', async () => {
    // Don't set API key
    delete process.env.SNIP_AI_API_KEY;
    
    const ai = require('../lib/commands/ai');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await ai.generate('test', {});

    spyError.mockRestore();
    mockExit.mockRestore();

    const errorOutput = errors.join('\n');
    expect(errorOutput).toContain('API key not configured');
  });

  test('should handle API errors gracefully', async () => {
    mockOpenAIGenerate.mockRejectedValue(new Error('Invalid API key'));
    
    const ai = require('../lib/commands/ai');

    const errors = [];
    const spyError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    await ai.generate('test', {});

    spyError.mockRestore();
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