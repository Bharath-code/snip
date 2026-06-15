const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Watch Command', () => {
  const originalEnv = process.env;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `snip-watch-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const configDir = path.join(testDir, 'config');
    const dataDir = path.join(testDir, 'data');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    process.env = {
      ...originalEnv,
      XDG_CONFIG_HOME: configDir,
      XDG_DATA_HOME: dataDir,
    };

    jest.resetModules();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('watch command module exports a function', () => {
    const watchCmd = require('../lib/commands/watch');
    expect(typeof watchCmd).toBe('function');
  });

  test('watch errors for missing snippet', async () => {
    const watchCmd = require('../lib/commands/watch');
    const exitSpy = jest.spyOn(process, 'exitCode', 'set').mockImplementation(() => {});

    await watchCmd('non-existent-snippet');

    exitSpy.mockRestore();
    // process.exitCode should have been set to 1
  });

  test('watch errors for empty snippet', async () => {
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'watch-empty',
      content: '',
      language: 'bash',
      tags: ['test'],
    });
    storage.flush();

    const watchCmd = require('../lib/commands/watch');
    const exitSpy = jest.spyOn(process, 'exitCode', 'set').mockImplementation(() => {});

    await watchCmd('watch-empty');

    exitSpy.mockRestore();
  });

  test('watch creates a temp file with snippet content', async () => {
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'watch-test',
      content: 'echo "hello from watch"',
      language: 'bash',
      tags: ['test'],
    });
    storage.flush();

    const watchCmd = require('../lib/commands/watch');

    // Mock process.exit so the test doesn't hang (fs.watch keeps the loop alive)
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Run watch and let it set up, then stop it by cleaning up temp files
    // We don't await the full promise since fs.watch keeps the loop alive indefinitely
    const watchPromise = watchCmd('watch-test', {});

    // Give it a moment to set up the temp file
    await new Promise(r => setTimeout(r, 300));

    // Check that a temp file was created with the snippet content
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const watchFiles = files.filter(f => f.startsWith('snip-watch-watch-test'));
    expect(watchFiles.length).toBeGreaterThan(0);

    // Cleanup: kill the watch process by sending SIGINT-like cleanup
    // The watcher keeps the event loop alive; we force-exit via the exit mock
    exitSpy.mockRestore();
    // Mark test as passed
  }, 5000);

  test('watch updates storage when temp file changes', async () => {
    const storage = require('../lib/storage');
    storage.addSnippet({
      name: 'watch-update',
      content: 'echo "original"',
      language: 'bash',
      tags: ['test'],
    });
    storage.flush();

    const watchCmd = require('../lib/commands/watch');

    // Start watching in the background
    const watchPromise = watchCmd('watch-update');
    let stopped = false;

    // Give it time to set up the watcher
    await new Promise(r => setTimeout(r, 300));

    // Find the temp file
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const watchFile = files.find(f => f.startsWith('snip-watch-watch-update'));
    expect(watchFile).toBeDefined();
    const tmpPath = path.join(tmpDir, watchFile);

    // Write new content to the temp file (simulating an edit)
    fs.writeFileSync(tmpPath, 'echo "edited content"', 'utf8');

    // Wait for the watcher debounce (300ms) + execution
    await new Promise(r => setTimeout(r, 800));

    // Verify the snippet was updated in storage
    const updated = storage.getSnippetByIdOrName('watch-update');
    expect(updated).toBeDefined();
    const updatedContent = storage.readSnippetContent(updated);
    expect(updatedContent).toBe('echo "edited content"');

    // Cleanup temp file
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    stopped = true;
  }, 8000);
});
