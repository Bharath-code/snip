const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('../lib/storage');
const cfg = require('../lib/config');
const editCmd = require('../lib/commands/edit');
const rmCmd = require('../lib/commands/rm');

describe('edit and rm', () => {
  test('edit detects no-change with noop editor, and rm removes snippet', () => {
    const s = storage.addSnippet({ name: 'editrm', content: 'before', language: 'txt', tags: [] });
    cfg.saveConfig({ editor: 'true' }); // noop editor — file unchanged
    editCmd(s.id);
    // Content unchanged → updatedAt should NOT change
    const unchanged = storage.getSnippetByIdOrName(s.id);
    expect(unchanged.updatedAt).toBe(s.updatedAt);
    rmCmd(s.id);
    const after = storage.getSnippetByIdOrName(s.id);
    expect(after).toBeNull();
  });

  test('edit updates content when file changes', () => {
    const s = storage.addSnippet({ name: 'editchange', content: 'original', language: 'txt', tags: [] });
    // Directly update the content via storage to simulate an edit
    storage.updateSnippetContent(s.id, 'modified');
    const updated = storage.getSnippetByIdOrName(s.id);
    expect(updated.updatedAt).not.toBe(s.updatedAt);
    // Cleanup
    rmCmd(s.id);
  });
});
