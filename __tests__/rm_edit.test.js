const storage = require('../lib/storage');
const cfg = require('../lib/config');
const editCmd = require('../lib/commands/edit');
const rmCmd = require('../lib/commands/rm');

describe('edit and rm', () => {
  test('edit updates updatedAt and rm removes snippet', () => {
    const s = storage.addSnippet({ name: 'editrm', content: 'before', language: 'txt', tags: [] });
    const before = s.updatedAt;
    cfg.saveConfig({ editor: 'true' }); // use shell `true` as noop editor
    editCmd(s.id);
    const updated = storage.getSnippetByIdOrName(s.id);
    expect(updated.updatedAt).not.toBe(before);
    rmCmd(s.id);
    const after = storage.getSnippetByIdOrName(s.id);
    expect(after).toBeNull();
  });
});
