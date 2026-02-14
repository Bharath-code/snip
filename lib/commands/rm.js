const storage = require('../storage');

function remove(idOrName) {
  const s = storage.getSnippetByIdOrName(idOrName);
  if (!s) return console.error('Snippet not found');
  storage.deleteSnippetById(s.id);
  console.log('Removed', s.id);
}

module.exports = remove;
