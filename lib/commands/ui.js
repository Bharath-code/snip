const blessed = require('blessed');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const storage = require('../storage');
const Fuse = require('fuse.js');
const config = require('../config');
const exec = require('../exec');
const safety = require('../safety');
const clipboard = require('../clipboard');

const LIST_KEYS = ['name', 'tags', 'content'];
const FUSE_OPTIONS = { keys: LIST_KEYS, threshold: 0.4, ignoreLocation: true };
const FAST_MOVE_STEP = 5;

// High-contrast terminal palette with clear hierarchy.
const THEME = {
  border: { fg: 'blue' },
  borderFocus: { fg: 'light-cyan' },
  selected: { bg: 'light-cyan', fg: 'black', bold: true },
  item: { fg: 'white' },
  muted: { fg: 'gray', bold: false },
  accent: { fg: 'light-cyan' },
  success: { fg: 'green' },
  warning: { fg: 'yellow' },
  error: { fg: 'red' },
  headerBg: 'blue',
  headerFg: 'white',
  footerBg: 'black',
  footerFg: 'gray',
  labelBg: 'blue',
  labelFg: 'white'
};

function getFilteredSnippets(all, tagFilter, searchQuery) {
  let list = tagFilter
    ? all.filter(s => (s.tags || []).includes(tagFilter))
    : all.slice();
  if (searchQuery.trim()) {
    const fuse = new Fuse(list.map(s => ({
      ...s,
      content: (storage.readSnippetContent(s) || '').slice(0, 1000)
    })), FUSE_OPTIONS);
    const results = fuse.search(searchQuery, { limit: 500 });
    list = results.map(r => r.item);
  }
  return list;
}

function getUniqueTags(snippets) {
  const set = new Set();
  snippets.forEach(s => (s.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function truncate(text, max) {
  if (!text || max <= 0) return '';
  if (text.length <= max) return text;
  if (max <= 3) return '.'.repeat(max);
  return text.slice(0, max - 3) + '...';
}

function clampIndex(index, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function getModalSize(screen, minWidth, maxWidth, minHeight, maxHeight) {
  const usableWidth = Math.max(16, screen.width - 2);
  const usableHeight = Math.max(8, screen.height - 2);
  const floorWidth = Math.min(minWidth, usableWidth);
  const floorHeight = Math.min(minHeight, usableHeight);
  const width = Math.max(floorWidth, Math.min(maxWidth, usableWidth));
  const height = Math.max(floorHeight, Math.min(maxHeight, usableHeight));
  return { width, height };
}

function formatListItems(filtered) {
  if (!filtered.length) return [];
  return filtered.map(s => {
    const name = truncate(String(s.name || 'untitled'), 30).padEnd(32, ' ');
    const tags = truncate((s.tags || []).join(', ') || 'no tags', 44);
    const language = truncate((s.language || '').trim(), 12);
    const langToken = language ? `[${language}]`.padEnd(14, ' ') : ''.padEnd(14, ' ');
    return ` ${name}{${THEME.accent.fg}-fg}${langToken}{/}{${THEME.muted.fg}-fg}${tags}{/}`;
  });
}

function runSnippet(snippet, screen, cb) {
  const content = storage.readSnippetContent(snippet);
  const cfg = config.loadConfig();
  const runner = exec.resolveRunner(snippet.language, cfg.defaultShell);
  const isDangerous = safety.isDangerous(content);
  const { width, height } = getModalSize(screen, 78, 118, 15, 36);

  const modal = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width,
    height,
    padding: { top: 1, right: 1, bottom: 1, left: 1 },
    border: { type: 'line', fg: THEME.accent.fg },
    style: { border: THEME.border, bg: 'black', fg: 'white' },
    keys: true,
    scrollable: true,
    tags: true,
    label: { text: ` Run snippet (${runner.command}) `, side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
  });

  const preview = blessed.box({
    parent: modal,
    top: 0,
    left: 0,
    width: '100%-2',
    height: '100%-4',
    content: 'Preview:\n\n' + content + (isDangerous ? '\n\n⚠ Potentially dangerous. Press y to run anyway.' : ''),
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    mouse: false,
    keys: true,
    vi: true,
    scrollbar: { style: { bg: THEME.accent.fg } }
  });

  blessed.text({
    parent: modal,
    bottom: 0,
    left: 0,
    width: '100%',
    content: isDangerous
      ? ' ↑↓/PgUp/PgDn scroll  [y] run anyway  [n/Esc] cancel '
      : ' ↑↓/PgUp/PgDn scroll  [y] run  [n/Esc] cancel ',
    style: { fg: THEME.warning.fg, bg: 'black' }
  });

  function abort() {
    modal.destroy();
    screen.render();
    cb(null);
  }
  function run() {
    modal.destroy();
    screen.render();
    const status = exec.runSnippetContent(content, {
      dryRun: false,
      shell: cfg.defaultShell,
      language: snippet.language
    });
    if (status === 0) storage.touchUsage(snippet);
    if (screen.realloc) screen.realloc();
    cb(status);
  }

  modal.key(['escape', 'q', 'n'], abort);
  preview.key(['escape', 'q', 'n'], abort);
  modal.key('y', run);
  preview.key('y', run);
  preview.focus();
  screen.render();
}

function showSnippet(snippet, screen, cb) {
  const content = storage.readSnippetContent(snippet);
  const { width, height } = getModalSize(screen, 78, 120, 14, 34);
  const box = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width,
    height,
    padding: { top: 1, right: 1, bottom: 1, left: 1 },
    border: { type: 'line', fg: THEME.success.fg },
    style: { border: THEME.border, bg: 'black', fg: 'white' },
    keys: true,
    scrollable: true,
    tags: true,
    label: { text: ` ${snippet.name} `, side: 'left', fg: THEME.labelFg, bg: THEME.success.fg }
  });
  const text = blessed.box({
    parent: box,
    top: 0,
    left: 0,
    width: '100%-2',
    height: '100%-3',
    content,
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    mouse: false,
    keys: true,
    vi: true,
    scrollbar: { style: { bg: THEME.success.fg } }
  });
  const footerDefault = ' ↑↓/PgUp/PgDn scroll  [c] copy all  [p] open pager  [q/Esc] close ';
  const footer = blessed.text({
    parent: box,
    bottom: 0,
    left: 0,
    width: '100%',
    content: footerDefault,
    style: { fg: THEME.muted.fg, bg: 'black' }
  });
  let footerTimer = null;
  function showFooterMessage(message, style, timeoutMs) {
    if (footerTimer) clearTimeout(footerTimer);
    footer.style.fg = style.fg;
    footer.setContent(message);
    screen.render();
    if (timeoutMs > 0) {
      footerTimer = setTimeout(() => {
        footer.style.fg = THEME.muted.fg;
        footer.setContent(footerDefault);
        screen.render();
      }, timeoutMs);
    }
  }
  function copySnippetContent() {
    const result = clipboard.copyText(content);
    if (result.ok) {
      showFooterMessage(` Copied snippet to clipboard (${result.command}) `, THEME.success, 1800);
      return;
    }
    showFooterMessage(' Clipboard unavailable. Use terminal select + copy. ', THEME.warning, 2600);
  }
  function openInPager() {
    const pagerRaw = process.env.PAGER || 'less -R';
    const pager = pagerRaw.split(' ').filter(Boolean);
    const tmpFile = path.join(os.tmpdir(), `snip-view-${snippet.id}.txt`);
    const pagerEnv = { ...process.env, LESSOPEN: '', LESSCLOSE: '' };
    try {
      fs.writeFileSync(tmpFile, content, 'utf8');
      if (screen.leave) screen.leave();
      const res = spawnSync(pager[0], pager.slice(1).concat([tmpFile]), {
        stdio: 'inherit',
        env: pagerEnv
      });
      if (screen.enter) screen.enter();
      if (res.error && res.error.code === 'ENOENT') {
        showFooterMessage(` Pager not found: ${pager[0]} `, THEME.warning, 2600);
      } else {
        showFooterMessage(' Returned from pager. ', THEME.accent, 1200);
      }
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      text.focus();
      screen.render();
    }
  }
  function close() {
    if (footerTimer) clearTimeout(footerTimer);
    box.destroy();
    screen.render();
    cb();
  }
  box.key(['c', 'y'], copySnippetContent);
  text.key(['c', 'y'], copySnippetContent);
  box.key(['p'], openInPager);
  text.key(['p'], openInPager);
  box.key(['escape', 'q'], () => {
    close();
  });
  text.key(['escape', 'q'], () => {
    close();
  });
  text.focus();
  screen.render();
}

function showHelpOverlay(screen, helpBar, cb) {
  const lines = [
    ' SNIP — KEYBOARD SHORTCUTS ',
    '',
    '  Navigation',
    '    j / ↓      Move down',
    '    k / ↑      Move up',
    '    Ctrl+d     Jump down (+5)',
    '    Ctrl+u     Jump up (-5)',
    '    g          Go to first',
    '    G          Go to last',
    '',
    '  Actions',
    '    Enter      Show snippet content',
    '    c          Copy selected snippet',
    '    p (view)   Open snippet in pager',
    '    r          Run snippet (preview + confirm)',
    '    /          Fuzzy search (type to filter)',
    '    t          Filter by tag (↑↓ choose, Enter apply)',
    '',
    '  General',
    '    ?          This help',
    '    q / Ctrl+C Quit',
    '    Esc        Cancel search / tag filter',
    '',
    '  [Press any key to close]'
  ];
  const { width, height } = getModalSize(screen, 58, 66, 20, 24);
  const box = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width,
    height,
    padding: { top: 1, right: 2, bottom: 1, left: 2 },
    border: { type: 'line', fg: THEME.accent.fg },
    style: { border: THEME.border, bg: 'black', fg: 'white' },
    keys: true,
    tags: true,
    content: lines.join('\n'),
    label: { text: ' Help ', side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
  });
  let isClosed = false;
  function close() {
    if (isClosed) return;
    isClosed = true;
    box.destroy();
    screen.render();
    cb();
  }
  box.key(['escape', 'q', 'enter', 'space'], close);
  let ignoreFirstKeypress = true;
  setTimeout(() => {
    ignoreFirstKeypress = false;
  }, 0);
  box.on('keypress', () => {
    if (ignoreFirstKeypress) return;
    close();
  });
  box.focus();
  screen.render();
}

const HELP_BAR_DEFAULT = ' j/k:move  Ctrl+d/u:jump  Enter:open  c:copy  r:run  /:search  t:tag  ?:help  q:quit ';

function showRunFeedback(screen, helpBar, status, cb) {
  const msg = status === 0 ? ' Done (exit 0) ' : ` Failed (exit ${status}) `;
  const style = status === 0 ? THEME.success : THEME.error;
  helpBar.setContent(`{${style.fg}-fg}${msg}{/}  ${HELP_BAR_DEFAULT}`);
  helpBar.style.fg = style.fg;
  screen.render();
  setTimeout(() => {
    helpBar.setContent(HELP_BAR_DEFAULT);
    helpBar.style.fg = THEME.footerFg;
    screen.render();
    if (cb) cb();
  }, 2200);
}

function start() {
  const all = storage.listSnippets();
  let tagFilter = null;
  let searchQuery = '';
  let filtered = getFilteredSnippets(all, tagFilter, searchQuery);
  let selectedIndex = 0;
  let tagPickerActive = false;
  let tagList = [];
  let tagIndex = 0;
  let helpTimer = null;

  const screen = blessed.screen({
    smartCSR: true,
    title: 'snip',
    fullUnicode: true,
    cursor: { artificial: 'line', shape: 'line', blink: true }
  });

  const headerLeft = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '50%',
    height: 1,
    content: ' snip ',
    style: { fg: THEME.headerFg, bg: THEME.headerBg, bold: true },
    tags: true
  });
  const headerRight = blessed.box({
    parent: screen,
    top: 0,
    right: 0,
    width: '50%',
    height: 1,
    content: '',
    align: 'right',
    style: { fg: THEME.headerFg, bg: THEME.headerBg },
    tags: true
  });

  const searchBox = blessed.textbox({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line', fg: THEME.accent.fg },
    padding: { left: 1, right: 1 },
    style: { fg: 'white', border: THEME.borderFocus, bg: 'black' },
    keys: true,
    inputOnFocus: true,
    tags: true,
    label: { text: ' Search ', side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
  });
  searchBox.hide();

  const listBox = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-2',
    keys: true,
    vi: true,
    mouse: true,
    padding: { left: 0, right: 0 },
    style: {
      selected: THEME.selected,
      item: THEME.item,
      border: THEME.border
    },
    border: { type: 'line', fg: THEME.border.fg },
    tags: true,
    items: formatListItems(filtered).length ? formatListItems(filtered) : ['  No snippets yet. Add one: echo "echo hi" | snip add hello --tags demo ']
  });

  const helpBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: { fg: THEME.footerFg, bg: THEME.footerBg },
    content: HELP_BAR_DEFAULT,
    tags: true
  });

  function clearHelpTimer() {
    if (helpTimer) {
      clearTimeout(helpTimer);
      helpTimer = null;
    }
  }

  function flashHelp(message, style = THEME.accent, timeoutMs = 1800) {
    clearHelpTimer();
    helpBar.style.fg = style.fg;
    helpBar.setContent(message);
    screen.render();
    if (timeoutMs > 0) {
      helpTimer = setTimeout(() => {
        setHelpBarDefault();
        screen.render();
      }, timeoutMs);
    }
  }

  function updateHeader() {
    const parts = [];
    if (tagFilter) parts.push(`tag: ${tagFilter}`);
    if (searchQuery.trim()) parts.push(`“${searchQuery}”`);
    const filterStr = parts.length ? '  |  ' + parts.join('  ') : '';
    headerLeft.setContent(` snip ${filterStr}`);
    headerRight.setContent(`${filtered.length}/${all.length} snippet${all.length === 1 ? '' : 's'} `);
    screen.render();
  }

  function refreshList() {
    filtered = getFilteredSnippets(all, tagFilter, searchQuery);
    selectedIndex = clampIndex(selectedIndex, filtered.length);
    const items = filtered.length ? formatListItems(filtered) : ['  No matches. Change search or tag filter. '];
    listBox.setItems(items);
    if (filtered.length) {
      listBox.select(selectedIndex);
    } else {
      listBox.select(0);
    }
    updateHeader();
    screen.render();
  }

  function focusSearch() {
    searchBox.show();
    if (searchBox.setValue) searchBox.setValue(searchQuery);
    else searchBox.setContent(searchQuery);
    searchBox.focus();
    listBox.hide();
    headerLeft.setContent(' snip  |  Type to filter... ');
    headerRight.setContent(' Enter: apply   Esc: cancel ');
    screen.render();
  }

  function toggleTagFilter() {
    if (tagPickerActive) {
      tagPickerActive = false;
      listBox.focus();
      refreshList();
      screen.render();
      return;
    }
    const tags = getUniqueTags(all);
    if (tags.length === 0) {
      flashHelp(' No tags found. Add tags with: snip add foo --tags a,b ', THEME.warning, 2200);
      listBox.focus();
      return;
    }
    tagPickerActive = true;
    tagList = tags;
    tagIndex = tagFilter ? tagList.indexOf(tagFilter) : 0;
    if (tagIndex < 0) tagIndex = 0;
    helpBar.style.fg = THEME.accent.fg;
    helpBar.setContent(' ↑↓ Select tag  Ctrl+d/u jump  Enter apply  Esc cancel  → ' + tagList[tagIndex]);
    screen.render();
  }

  function setHelpBarDefault() {
    clearHelpTimer();
    helpBar.setContent(HELP_BAR_DEFAULT);
    helpBar.style.fg = THEME.footerFg;
  }

  function selectRelative(delta) {
    if (tagPickerActive) {
      tagIndex = clampIndex(tagIndex + delta, tagList.length);
      helpBar.setContent(' ↑↓ Select tag  Ctrl+d/u jump  Enter apply  Esc cancel  → ' + tagList[tagIndex]);
      screen.render();
      return;
    }
    if (!filtered.length) return;
    selectedIndex = clampIndex(selectedIndex + delta, filtered.length);
    listBox.select(selectedIndex);
    updateHeader();
    screen.render();
  }

  function selectAbsolute(index) {
    if (tagPickerActive) {
      tagIndex = clampIndex(index, tagList.length);
      helpBar.setContent(' ↑↓ Select tag  Ctrl+d/u jump  Enter apply  Esc cancel  → ' + tagList[tagIndex]);
      screen.render();
      return;
    }
    if (!filtered.length) return;
    selectedIndex = clampIndex(index, filtered.length);
    listBox.select(selectedIndex);
    updateHeader();
    screen.render();
  }

  function copySelectedSnippet() {
    if (tagPickerActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    const result = clipboard.copyText(storage.readSnippetContent(snippet));
    if (result.ok) {
      flashHelp(` Copied "${snippet.name}" to clipboard (${result.command}) `, THEME.success, 1800);
      return;
    }
    flashHelp(' Clipboard unavailable. Open snippet with Enter to manually select/copy text. ', THEME.warning, 2600);
  }

  searchBox.on('submit', () => {
    const raw = (searchBox.getValue ? searchBox.getValue() : searchBox.content || '').trim();
    searchQuery = raw.startsWith('/') ? raw.slice(1).trim() : raw;
    searchBox.hide();
    if (searchBox.clearValue) searchBox.clearValue();
    listBox.show();
    listBox.focus();
    refreshList();
    setHelpBarDefault();
    screen.render();
  });

  searchBox.on('cancel', () => {
    searchBox.hide();
    if (searchBox.clearValue) searchBox.clearValue();
    listBox.show();
    listBox.focus();
    updateHeader();
    setHelpBarDefault();
    screen.render();
  });

  listBox.on('select', (el, i) => {
    selectedIndex = i;
  });
  listBox.on('focus', () => {
    listBox.style.border = THEME.borderFocus;
    screen.render();
  });
  listBox.on('blur', () => {
    listBox.style.border = THEME.border;
    screen.render();
  });

  listBox.key('r', () => {
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    runSnippet(snippet, screen, (status) => {
      listBox.focus();
      if (status !== null && status !== undefined) showRunFeedback(screen, helpBar, status);
      else screen.render();
    });
  });

  listBox.key('c', () => copySelectedSnippet());
  listBox.key('t', () => toggleTagFilter());
  listBox.key('/', () => focusSearch());
  listBox.key('?', () => {
    showHelpOverlay(screen, helpBar, () => {
      listBox.focus();
      setHelpBarDefault();
      screen.render();
    });
  });

  listBox.key(['j', 'down'], () => {
    selectRelative(1);
  });

  listBox.key(['k', 'up'], () => {
    selectRelative(-1);
  });

  listBox.key(['C-d', 'pagedown', 'J'], () => {
    selectRelative(FAST_MOVE_STEP);
  });

  listBox.key(['C-u', 'pageup', 'K'], () => {
    selectRelative(-FAST_MOVE_STEP);
  });

  listBox.key('g', () => {
    selectAbsolute(0);
  });

  listBox.key('G', () => {
    const index = tagPickerActive ? Math.max(0, tagList.length - 1) : Math.max(0, filtered.length - 1);
    selectAbsolute(index);
  });

  listBox.key('enter', () => {
    if (tagPickerActive) {
      tagFilter = tagList[tagIndex] || null;
      tagPickerActive = false;
      refreshList();
      setHelpBarDefault();
    } else {
      const snippet = filtered[selectedIndex];
      if (snippet) showSnippet(snippet, screen, () => { listBox.focus(); screen.render(); });
    }
    screen.render();
  });

  function quit() {
    clearHelpTimer();
    screen.destroy();
    process.exit(0);
  }

  listBox.key(['q'], () => quit());
  screen.key(['C-c'], () => quit());

  listBox.key(['escape'], () => {
    if (tagPickerActive) {
      tagPickerActive = false;
      setHelpBarDefault();
    }
    screen.render();
  });

  listBox.focus();
  setHelpBarDefault();
  refreshList();
  screen.render();
}

function ui() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('snip ui requires an interactive terminal (TTY).');
    process.exitCode = 1;
    return;
  }
  // Avoid terminfo quirks (e.g. Ghostty's Setulc) by using a well-supported TERM
  const termOverride = process.env.TERM;
  if (!termOverride || /ghostty|wezterm|kitty/i.test(termOverride)) {
    process.env.TERM = 'xterm-256color';
  }
  try {
    start();
  } catch (e) {
    console.error('TUI failed:', e.message);
    process.exitCode = 1;
  }
}

module.exports = ui;
