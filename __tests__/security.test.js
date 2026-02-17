const storage = require('../lib/storage');
const config = require('../lib/config');
const fs = require('fs');
const path = require('path');

describe('storage', () => {
  const testSnippet = {
    name: 'testunit',
    content: 'echo hi',
    language: 'sh',
    tags: ['test']
  };

  test('add and retrieve snippet', () => {
    const s = storage.addSnippet(testSnippet);
    expect(s).toBeDefined();
    expect(s).toHaveProperty('id');
    const list = storage.listSnippets();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find(x => x.id === s.id);
    expect(found).toBeDefined();
    const read = storage.getSnippetByIdOrName(s.id);
    expect(read.name).toBe('testunit');
  });

  test('sanitizes malicious snippet names', () => {
    const maliciousNames = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      'foo/../../../bar',
      'test<script>',
      'test\x00null',
      '   spaces  '
    ];

    for (const name of maliciousNames) {
      const s = storage.addSnippet({ name, content: 'echo test', language: 'sh', tags: [] });
      expect(s.name).not.toMatch(/[^\w-]/);
      expect(s.name).not.toContain('..');
      storage.deleteSnippetById(s.id);
    }
  });

  test('rejects empty snippet names', () => {
    expect(() => {
      storage.addSnippet({ name: '', content: 'echo test', language: 'sh', tags: [] });
    }).toThrow();
  });

  test('handles special characters in language', () => {
    const s = storage.addSnippet({ name: 'test-lang', content: 'echo test', language: 'sh', tags: [] });
    expect(s.language).toBe('sh');
    storage.deleteSnippetById(s.id);
  });

  test('snippet metadata is properly stored', () => {
    const s = storage.addSnippet({
      name: 'meta-test',
      content: 'echo test',
      language: 'bash',
      tags: ['tag1', 'tag2']
    });
    
    const found = storage.getSnippetByIdOrName(s.id);
    expect(found.tags).toEqual(['tag1', 'tag2']);
    expect(found.language).toBe('bash');
    
    storage.deleteSnippetById(s.id);
  });
});

describe('config', () => {
  test('loads default config', () => {
    const cfg = config.loadConfig();
    expect(cfg).toBeDefined();
    expect(cfg.editor).toBeDefined();
    expect(cfg.useSqlite).toBe(false);
  });

  test('validates allowed config keys', () => {
    const testDir = path.join(__dirname, 'test-config-temp');
    
    // Mock CONFIG_FILE for testing
    const originalConfigFile = config.CONFIG_FILE;
    const testConfigFile = path.join(testDir, 'config.json');
    
    try {
      fs.mkdirSync(testDir, { recursive: true });
      
      // Write malicious config with unexpected keys
      const maliciousConfig = {
        editor: 'vim',
        __proto__: { malicious: true },
        shell: '/bin/malicious',
        dataDir: '/tmp/malicious',
        useSqlite: true,
        unknownKey: 'should-be-ignored'
      };
      fs.writeFileSync(testConfigFile, JSON.stringify(maliciousConfig));
      
      // Temporarily override CONFIG_FILE
      Object.defineProperty(config, 'CONFIG_FILE', { value: testConfigFile });
      
      const cfg = config.loadConfig();
      
      // Only allowed keys should be present (shell and dataDir are not in allowedKeys)
      expect(cfg.shell).toBeUndefined();
      expect(cfg.dataDir).toBeUndefined();
      expect(cfg.unknownKey).toBeUndefined();
      expect(cfg.useSqlite).toBe(true);
      
    } finally {
      // Cleanup
      Object.defineProperty(config, 'CONFIG_FILE', { value: originalConfigFile });
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
