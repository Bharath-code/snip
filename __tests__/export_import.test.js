const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../lib/storage');
const exportCmd = require('../lib/commands/export');
const importCmd = require('../lib/commands/import');

describe('export/import', () => {
  test('export to file and import restores snippets', () => {
    const s = storage.addSnippet({ name: 'expimp', content: 'hello-export', language: 'txt', tags: ['x'] });
    const tmp = path.join(os.tmpdir(), `snips-${Date.now()}.json`);
    exportCmd(tmp);
    const raw = fs.readFileSync(tmp, 'utf8');
    expect(raw).toContain('hello-export');
    // remove snippet
    const id = s.id;
    const rm = require('../lib/commands/rm');
    rm(id);
    const after = storage.getSnippetByIdOrName(id);
    expect(after).toBeNull();
    // import
    importCmd(tmp);
    const list = storage.listSnippets();
    const any = list.find(x => storage.readSnippetContent(x).includes('hello-export'));
    expect(any).toBeDefined();
  });
});
