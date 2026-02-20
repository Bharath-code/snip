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

// Syntax highlighting — graceful fallback to raw text
let _highlight;
try {
  _highlight = require('cli-highlight').highlight;
} catch (_) {
  _highlight = null;
}

const LIST_KEYS = ['name', 'tags', 'content'];
const FUSE_OPTIONS = { keys: LIST_KEYS, threshold: 0.4, ignoreLocation: true };
const FAST_MOVE_STEP = 5;
const SPLIT_MIN_WIDTH = 80;
const SPLIT_WIDE_WIDTH = 120;

// Helper: add line numbers to content string
function addLineNumbers(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const pad = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(pad, ' ')} ${G.bar} ${l}`).join('\n');
}

// Security: strip blessed tag markers from user-derived strings
function safeTag(str) {
  return String(str || '').replace(/[{}]/g, '');
}

// Security: allowlisted env keys for spawned pager processes
const SAFE_PAGER_ENV_KEYS = ['HOME', 'PATH', 'TERM', 'LANG', 'PAGER', 'LESS', 'SHELL', 'USER', 'LOGNAME'];

// ── Unicode glyphs ──────────────────────────────────────────────────
const G = {
  dot: '●',
  hollow: '○',
  arrow: '›',
  usage: '↻',
  sort: '↕',
  check: '✓',
  cross: '✗',
  warn: '⚠',
  bar: '│',
  dash: '─',
  corner: '╭',
  search: '⌕',
};

// ── Catppuccin Mocha inspired palette ───────────────────────────────
// Designed for readability on both dark and light terminal backgrounds.
const THEME = {
  border: { fg: '#585B70' },
  borderFocus: { fg: '#89B4FA' },
  selected: { bg: '#89B4FA', fg: '#1E1E2E', bold: true },
  item: { fg: '#CDD6F4' },
  muted: { fg: '#6C7086' },
  accent: { fg: '#94E2D5' },
  success: { fg: '#A6E3A1' },
  warning: { fg: '#F9E2AF' },
  error: { fg: '#F38BA8' },
  headerBg: '#313244',
  headerFg: '#CDD6F4',
  footerBg: '#1E1E2E',
  footerFg: '#6C7086',
  labelBg: '#45475A',
  labelFg: '#CDD6F4',
  preview: { fg: '#BAC2DE' },
  badge: { fg: '#F5C2E7' },
};

// Performance: cache Fuse index + pre-built corpus, rebuild only when snippet list changes
let _fuseCache = { list: null, fuse: null, corpus: null };
const MAX_PAGER_BYTES = 1024 * 1024; // 1MB — matches storage.MAX_CONTENT_LENGTH

function getFilteredSnippets(all, tagFilter, searchQuery) {
  let list = tagFilter
    ? all.filter(s => (s.tags || []).includes(tagFilter))
    : all.slice();
  if (searchQuery.trim()) {
    // Rebuild index only when source list changes
    if (_fuseCache.list !== all) {
      _fuseCache.corpus = all.map(s => ({
        ...s,
        content: (storage.readSnippetContent(s) || '').slice(0, 1000)
      }));
      _fuseCache.fuse = new Fuse(_fuseCache.corpus, FUSE_OPTIONS);
      _fuseCache.list = all;
    }
    const results = _fuseCache.fuse.search(searchQuery, { limit: 500 });
    const matchIds = new Set(results.map(r => r.item.id));
    list = list.filter(s => matchIds.has(s.id));
  }
  return list;
}

function invalidateFuseCache() {
  _fuseCache = { list: null, fuse: null, corpus: null };
}

function getUniqueTags(snippets) {
  const set = new Set();
  snippets.forEach(s => (s.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

// Helper: spawn an external command (editor, runner) while blessed is active.
// Blessed holds the alt-screen buffer + raw stdin — must release both first.
function spawnExternal(screen, cmd, args) {
  try {
    screen.program.normalBuffer();
    screen.program.showCursor();
  } catch (e) { /* older blessed versions */ }
  if (process.stdin.setRawMode) process.stdin.setRawMode(false);
  process.stdin.pause();

  const result = spawnSync(cmd, args, { stdio: 'inherit' });

  process.stdin.resume();
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
  try {
    screen.program.alternateBuffer();
    screen.program.hideCursor();
  } catch (e) { /* older blessed versions */ }
  if (screen.alloc) screen.alloc();
  screen.render();
  return result;
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

function formatListItems(filtered, listWidth) {
  if (!filtered.length) return [];
  const w = listWidth || 80;
  return filtered.map(s => {
    const nameMax = Math.min(28, Math.floor(w * 0.3));
    const name = truncate(String(s.name || 'untitled'), nameMax).padEnd(nameMax + 2, ' ');
    const language = truncate((s.language || '').trim(), 8);
    const langSafe = safeTag(language);
    const langToken = langSafe ? `{${THEME.muted.fg}-fg}[${langSafe}]{/}` : '';
    const langPad = langSafe ? 10 - langSafe.length : 0;
    const pad1 = ' '.repeat(Math.max(1, langPad));
    const tagsMax = Math.max(12, Math.floor(w * 0.3));
    const tags = truncate(safeTag((s.tags || []).join(', ')), tagsMax);
    const tagsStr = tags ? `{${THEME.accent.fg}-fg}${tags}{/}` : `{${THEME.muted.fg}-fg}${G.dash}{/}`;
    const usage = s.usageCount ? `{${THEME.badge.fg}-fg}${G.usage}${s.usageCount}{/}` : '';
    return ` ${G.hollow} ${name}${langToken}${pad1}${tagsStr}  ${usage}`;
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
    border: { type: 'line', fg: THEME.warning.fg },
    style: { border: { fg: THEME.warning.fg }, bg: THEME.footerBg, fg: THEME.item.fg },
    keys: true,
    scrollable: true,
    tags: true,
    label: { text: ` ${G.dot} Run (${safeTag(runner.command)}) `, side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
  });

  const preview = blessed.box({
    parent: modal,
    top: 0,
    left: 0,
    width: '100%-2',
    height: '100%-4',
    content: content + (isDangerous ? `\n\n${G.warn} Potentially dangerous. Press y to run anyway.` : ''),
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
      ? ` ${G.warn} j/k:scroll  y:run anyway  n/Esc:cancel `
      : ` ${G.check} j/k:scroll  y:run  n/Esc:cancel `,
    style: { fg: THEME.warning.fg, bg: THEME.footerBg }
  });

  function abort() {
    modal.destroy();
    screen.render();
    cb(null);
  }
  function run() {
    modal.destroy();
    screen.render();
    // Leave blessed screen for snippet execution
    try {
      screen.program.normalBuffer();
      screen.program.showCursor();
    } catch (e) { /* fallback */ }
    if (process.stdin.setRawMode) process.stdin.setRawMode(false);
    process.stdin.pause();
    // Show "Running..." feedback in normal terminal (helpBar not in scope here)
    console.error(`${G.usage} Running ${snippet.name}...`);

    const status = exec.runSnippetContent(content, {
      dryRun: false,
      shell: cfg.defaultShell,
      language: snippet.language
    });

    // Return to blessed screen
    process.stdin.resume();
    if (process.stdin.setRawMode) process.stdin.setRawMode(true);
    try {
      screen.program.alternateBuffer();
      screen.program.hideCursor();
    } catch (e) { /* fallback */ }
    if (screen.alloc) screen.alloc();
    screen.render();

    if (status === 0) storage.touchUsage(snippet);
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
    border: { type: 'line', fg: THEME.accent.fg },
    style: { border: { fg: THEME.accent.fg }, bg: THEME.footerBg, fg: THEME.item.fg },
    keys: true,
    scrollable: true,
    tags: true,
    label: { text: ` ${G.dot} ${safeTag(snippet.name)} `, side: 'left', fg: THEME.labelFg, bg: THEME.accent.fg }
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
  const footerDefault = ` j/k:scroll  c:copy  p:pager  q/Esc:close `;
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
      showFooterMessage(` Copied snippet to clipboard (${safeTag(result.command)}) `, THEME.success, 1800);
      return;
    }
    showFooterMessage(' Clipboard unavailable. Use terminal select + copy. ', THEME.warning, 2600);
  }
  function openInPager() {
    const pagerRaw = process.env.PAGER || 'less -R';
    const pager = pagerRaw.split(' ').filter(Boolean);
    // Security: unique temp dir to prevent symlink races
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-pager-'));
    const tmpFile = path.join(tmpDir, 'snippet.txt');
    // Security: allowlisted env to avoid leaking secrets
    const pagerEnv = {};
    for (const k of SAFE_PAGER_ENV_KEYS) { if (process.env[k]) pagerEnv[k] = process.env[k]; }
    pagerEnv.LESSOPEN = ''; pagerEnv.LESSCLOSE = '';
    try {
      // Security: cap write to MAX_PAGER_BYTES
      const pagerContent = content.length > MAX_PAGER_BYTES
        ? content.slice(0, MAX_PAGER_BYTES) + '\n\n--- TRUNCATED (exceeded 1MB) ---'
        : content;
      fs.writeFileSync(tmpFile, pagerContent, 'utf8');
      if (screen.leave) screen.leave();
      const res = spawnSync(pager[0], pager.slice(1).concat([tmpFile]), {
        stdio: 'inherit',
        env: pagerEnv
      });
      if (screen.enter) screen.enter();
      if (res.error && res.error.code === 'ENOENT') {
        showFooterMessage(` Pager not found: ${safeTag(pager[0])} `, THEME.warning, 2600);
      } else {
        showFooterMessage(' Returned from pager. ', THEME.accent, 1200);
      }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }
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
    ` ${G.dot} SNIP ${G.dash} KEYBOARD SHORTCUTS`,
    '',
    `  {${THEME.accent.fg}-fg}Navigation{/}`,
    `    j / ${G.arrow}       Move down`,
    `    k / ${G.arrow}       Move up`,
    '    Ctrl+d      Jump down (+5)',
    '    Ctrl+u      Jump up (-5)',
    '    g           Go to first',
    '    G           Go to last',
    '',
    `  {${THEME.accent.fg}-fg}Actions{/}`,
    `    Enter        Show snippet content`,
    `    c            Copy selected snippet`,
    `    r            Run snippet (preview + confirm)`,
    `    e            Edit snippet in $EDITOR`,
    `    m            Edit tags/language`,
    `    a            Add new snippet`,
    `    d            Delete snippet (type name to confirm)`,
    `    z            Undo last delete (5s window)`,
    `    /            Fuzzy search (type to filter)`,
    `    t            Filter by tag`,
    `    s            Cycle sort (name ${G.arrow} usage ${G.arrow} recent)`,
    '',
    `  {${THEME.accent.fg}-fg}View Mode{/}`,
    `    c / y        Copy snippet content`,
    `    p            Open snippet in pager`,
    '',
    `  {${THEME.accent.fg}-fg}General{/}`,
    `    ?            This help`,
    `    q / Ctrl+C   Quit`,
    `    Esc          Cancel / clear filter`,
    '',
    `  {${THEME.muted.fg}-fg}[Press any key to close]{/}`
  ];
  const { width, height } = getModalSize(screen, 58, 66, 28, 34);
  const box = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width,
    height,
    padding: { top: 1, right: 2, bottom: 1, left: 2 },
    border: { type: 'line', fg: THEME.accent.fg },
    style: { border: { fg: THEME.accent.fg }, bg: THEME.footerBg, fg: THEME.item.fg },
    keys: true,
    tags: true,
    content: lines.join('\n'),
    label: { text: ` ${G.dot} Help `, side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
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

const SORT_MODES = ['name', 'usage', 'recent'];
const SORT_LABELS = { name: 'A-Z', usage: 'Most used', recent: 'Recent' };

function buildHelpBar(mode) {
  if (mode === 'tag') return ` ${G.sort} select tag  Enter:apply  Esc:cancel`;
  if (mode === 'search') return ` ${G.search} Type to filter...  Enter:apply  Esc:cancel`;
  return ` j/k:move  ${G.sort}s:sort  /:search  t:tag  Enter:open  c:copy  r:run  a:add  e:edit  m:meta  d:del  ?:help  q:quit`;
}

function showRunFeedback(screen, helpBar, status, cb) {
  const msg = status === 0 ? ` ${G.check} Done (exit 0) ` : ` ${G.cross} Failed (exit ${status}) `;
  const style = status === 0 ? THEME.success : THEME.error;
  helpBar.setContent(`{${style.fg}-fg}${msg}{/}  ${buildHelpBar()}`);
  helpBar.style.fg = style.fg;
  screen.render();
  setTimeout(() => {
    helpBar.setContent(buildHelpBar());
    helpBar.style.fg = THEME.footerFg;
    screen.render();
    if (cb) cb();
  }, 2200);
}

function start() {
  let all = storage.listSnippets();
  let tagFilter = null;
  let searchQuery = '';
  let sortMode = 0; // index into SORT_MODES
  let filtered = getFilteredSnippets(all, tagFilter, searchQuery);
  let selectedIndex = 0;
  let tagPickerActive = false;
  let helpTimer = null;
  let deleteConfirmActive = false;
  let _undoDelete = null; // { snippet, content, timer }

  // Load persisted sort preference
  const persistedSort = config.loadConfig().sortMode;
  if (typeof persistedSort === 'number' && persistedSort >= 0 && persistedSort < SORT_MODES.length) {
    sortMode = persistedSort;
  }

  // Sort helper
  const SORTERS = {
    name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
    usage: (a, b) => {
      const diff = (b.usageCount || 0) - (a.usageCount || 0);
      return diff !== 0 ? diff : String(a.name || '').localeCompare(String(b.name || ''));
    },
    recent: (a, b) => {
      const aTs = Date.parse(a.lastUsedAt || a.updatedAt || a.createdAt || 0) || 0;
      const bTs = Date.parse(b.lastUsedAt || b.updatedAt || b.createdAt || 0) || 0;
      return bTs !== aTs ? bTs - aTs : String(a.name || '').localeCompare(String(b.name || ''));
    }
  };

  const screen = blessed.screen({
    smartCSR: true,
    title: 'snip',
    fullUnicode: true,
    cursor: { artificial: 'line', shape: 'line', blink: true }
  });

  const isSplit = () => screen.width >= SPLIT_MIN_WIDTH;
  const calcListWidth = () => {
    if (!isSplit()) return screen.width;
    return screen.width >= SPLIT_WIDE_WIDTH ? Math.floor(screen.width * 0.35) : Math.floor(screen.width * 0.42);
  };
  const calcPreviewWidth = () => isSplit() ? screen.width - calcListWidth() : 0;

  // ── Header ──────────────────────────────────────────────────────────
  const headerLeft = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '60%',
    height: 1,
    content: ` ${G.dot} snip`,
    style: { fg: THEME.headerFg, bg: THEME.headerBg, bold: true },
    tags: true
  });
  const headerRight = blessed.box({
    parent: screen,
    top: 0,
    right: 0,
    width: '40%',
    height: 1,
    content: '',
    align: 'right',
    style: { fg: THEME.headerFg, bg: THEME.headerBg },
    tags: true
  });

  // ── Search ──────────────────────────────────────────────────────────
  const searchBox = blessed.textbox({
    parent: screen,
    top: 1,
    left: 0,
    width: calcListWidth(),
    height: 3,
    border: { type: 'line', fg: THEME.accent.fg },
    padding: { left: 1, right: 1 },
    style: { fg: THEME.item.fg, border: THEME.borderFocus, bg: THEME.footerBg },
    keys: true,
    inputOnFocus: true,
    tags: true,
    label: { text: ` ${G.search} Search `, side: 'left', fg: THEME.labelFg, bg: THEME.labelBg }
  });
  searchBox.hide();

  // ── List ────────────────────────────────────────────────────────────
  const listBox = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: calcListWidth(),
    height: '100%-2',
    keys: true,
    vi: false,
    mouse: true,
    padding: { left: 0, right: 0 },
    style: {
      selected: THEME.selected,
      item: THEME.item,
      border: THEME.border
    },
    border: { type: 'line', fg: THEME.border.fg },
    tags: true,
    items: ['  Loading...']
  });

  // ── Preview pane ────────────────────────────────────────────────────
  const previewBox = blessed.box({
    parent: screen,
    top: 1,
    right: 0,
    width: calcPreviewWidth(),
    height: '100%-2',
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
    border: { type: 'line', fg: THEME.border.fg },
    style: { fg: THEME.preview.fg, border: THEME.border },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: false,
    vi: false,
    scrollbar: { style: { bg: THEME.accent.fg } },
    label: { text: ' Preview ', side: 'left', fg: THEME.labelFg, bg: THEME.labelBg },
    content: ''
  });

  // ── Footer ──────────────────────────────────────────────────────────
  const helpBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: { fg: THEME.footerFg, bg: THEME.footerBg },
    content: buildHelpBar(),
    tags: true
  });

  // ── State helpers ───────────────────────────────────────────────────
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

  function setHelpBarDefault() {
    clearHelpTimer();
    helpBar.setContent(buildHelpBar());
    helpBar.style.fg = THEME.footerFg;
  }

  // Performance: cache preview content by snippet ID
  let _previewCache = { id: null, content: null };

  function updatePreview() {
    if (!isSplit()) {
      previewBox.hide();
      return;
    }
    previewBox.show();
    const snippet = filtered[selectedIndex];
    if (!snippet) {
      previewBox.setLabel({ text: ' Preview ', side: 'left', fg: THEME.labelFg, bg: THEME.labelBg });
      previewBox.setContent(`{${THEME.muted.fg}-fg}No snippet selected{/}`);
      return;
    }
    // Only re-read content when snippet changes
    if (_previewCache.id !== snippet.id) {
      _previewCache = { id: snippet.id, content: storage.readSnippetContent(snippet) };
    }
    const content = _previewCache.content;
    const lang = snippet.language ? `[${snippet.language}]` : '';
    previewBox.setLabel({ text: ` ${safeTag(snippet.name)} ${safeTag(lang)} `, side: 'left', fg: THEME.labelFg, bg: THEME.labelBg });
    // Syntax highlight + line numbers
    let display = content || '';
    if (display && _highlight && snippet.language) {
      try { display = _highlight(display, { language: snippet.language, ignoreIllegals: true }); } catch (_) { /* fallback */ }
    }
    display = display ? addLineNumbers(display) : `{${THEME.muted.fg}-fg}(empty){/}`;
    previewBox.setContent(display);
    previewBox.setScrollPerc(0);
  }

  function updateHeader() {
    const parts = [];
    if (tagFilter) parts.push(`{${THEME.accent.fg}-fg}${tagFilter}{/}`);
    if (searchQuery.trim()) parts.push(`{${THEME.warning.fg}-fg}"${searchQuery}"{/}`);
    const filterStr = parts.length ? ` ${G.arrow} ` + parts.join(` ${G.arrow} `) : '';
    headerLeft.setContent(` {bold}${G.dot} snip{/bold}${filterStr}`);
    const sortLabel = SORT_LABELS[SORT_MODES[sortMode]] || 'A-Z';
    headerRight.setContent(`{${THEME.muted.fg}-fg}${G.sort} ${sortLabel}{/}  {${THEME.accent.fg}-fg}${filtered.length}/${all.length}{/} snippets `);
    // Note: caller is responsible for screen.render()
  }

  function refreshList() {
    filtered = getFilteredSnippets(all, tagFilter, searchQuery);
    // Apply sort
    const key = SORT_MODES[sortMode];
    if (SORTERS[key]) filtered.sort(SORTERS[key]);
    selectedIndex = clampIndex(selectedIndex, filtered.length);
    const lw = calcListWidth();
    const items = filtered.length
      ? formatListItems(filtered, lw)
      : all.length === 0
        ? [`  {${THEME.accent.fg}-fg}${G.dot} No snippets yet. Press 'a' to create your first snippet.{/}`]
        : [`  {${THEME.muted.fg}-fg}No matches. Press Esc to clear filters.{/}`];
    listBox.setItems(items);
    if (filtered.length) {
      listBox.select(selectedIndex);
    } else {
      listBox.select(0);
    }
    updateHeader();
    updatePreview();
    screen.render();
  }

  function reloadAll() {
    all = storage.listSnippets();
    invalidateFuseCache();
    _previewCache = { id: null, content: null };
    refreshList();
  }

  // ── Incremental search ─────────────────────────────────────────
  let _searchMode = false;

  function focusSearch() {
    _searchMode = true;
    searchBox.show();
    if (searchBox.setValue) searchBox.setValue(searchQuery);
    else searchBox.setContent(searchQuery);
    searchBox.focus();
    // Keep list visible — shift it down below search box
    listBox.top = 4;
    listBox.height = screen.height - 5; // leave room for header + searchbox + footer
    headerLeft.setContent(` {bold}${G.dot} snip{/bold} ${G.arrow} {${THEME.warning.fg}-fg}search{/}`);
    headerRight.setContent(` Enter:apply  Esc:cancel `);
    helpBar.setContent(buildHelpBar('search'));
    screen.render();
  }

  function exitSearch() {
    _searchMode = false;
    searchBox.hide();
    if (searchBox.clearValue) searchBox.clearValue();
    listBox.top = 1;
    listBox.height = screen.height - 2;
    listBox.show();
    listBox.focus();
    setHelpBarDefault();
  }

  // ── Tag filter (modal) ───────────────────────────────────────────
  function toggleTagFilter() {
    if (tagPickerActive) return;
    const tags = getUniqueTags(all);
    if (tags.length === 0) {
      flashHelp(` ${G.warn} No tags found. Add tags with: snip add foo --tags a,b `, THEME.warning, 2200);
      listBox.focus();
      return;
    }
    tagPickerActive = true;
    const options = ['(all)', ...tags];
    let pickIndex = tagFilter ? options.indexOf(tagFilter) : 0;
    if (pickIndex < 0) pickIndex = 0;

    const { width, height } = getModalSize(screen, 36, 50, Math.min(options.length + 4, 20), 24);
    const tagModal = blessed.list({
      parent: screen,
      top: 'center',
      left: 'center',
      width,
      height,
      keys: false,
      vi: false,
      mouse: true,
      border: { type: 'line', fg: THEME.accent.fg },
      style: {
        selected: THEME.selected,
        item: THEME.item,
        border: { fg: THEME.accent.fg },
        bg: THEME.footerBg
      },
      tags: true,
      items: options.map((t, i) => i === 0 ? ` ${G.dot} ${t}` : ` ${G.hollow} ${safeTag(t)}`),
      label: { text: ` ${G.dot} Filter by tag `, side: 'left', fg: THEME.labelFg, bg: THEME.accent.fg }
    });
    tagModal.select(pickIndex);

    function closeTagModal(selected) {
      tagPickerActive = false;
      tagModal.destroy();
      listBox.focus();
      if (selected !== undefined) {
        tagFilter = selected === '(all)' ? null : selected;
        refreshList();
      }
      setHelpBarDefault();
      screen.render();
    }

    tagModal.key(['escape', 'q'], () => closeTagModal(undefined));
    tagModal.key('enter', () => {
      const idx = tagModal.selected || 0;
      closeTagModal(options[idx]);
    });
    tagModal.on('select', (el, idx) => closeTagModal(options[idx]));
    tagModal.key(['j', 'down'], () => {
      const cur = tagModal.selected || 0;
      tagModal.select(Math.min(cur + 1, options.length - 1));
      screen.render();
    });
    tagModal.key(['k', 'up'], () => {
      const cur = tagModal.selected || 0;
      tagModal.select(Math.max(cur - 1, 0));
      screen.render();
    });
    tagModal.focus();
    screen.render();
  }

  // ── Navigation ────────────────────────────────────────────────────
  function selectRelative(delta) {
    if (!filtered.length) return;
    selectedIndex = clampIndex(selectedIndex + delta, filtered.length);
    listBox.select(selectedIndex);
    updateHeader();
    updatePreview();
    screen.render();
  }

  function selectAbsolute(index) {
    if (!filtered.length) return;
    selectedIndex = clampIndex(index, filtered.length);
    listBox.select(selectedIndex);
    updateHeader();
    updatePreview();
    screen.render();
  }

  // ── Clipboard ───────────────────────────────────────────────────────
  function copySelectedSnippet() {
    if (tagPickerActive || deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    const result = clipboard.copyText(storage.readSnippetContent(snippet));
    if (result.ok) {
      flashHelp(` ${G.check} Copied "${safeTag(snippet.name)}" to clipboard `, THEME.success, 1800);
      return;
    }
    flashHelp(` ${G.cross} Clipboard unavailable. Press Enter to view and manually copy. `, THEME.warning, 2600);
  }

  // ── Sort cycling ────────────────────────────────────────────────────
  function cycleSort() {
    if (tagPickerActive || deleteConfirmActive) return;
    sortMode = (sortMode + 1) % SORT_MODES.length;
    const label = SORT_LABELS[SORT_MODES[sortMode]];
    flashHelp(` ${G.sort} Sort: ${label} `, THEME.accent, 1200);
    // Persist sort preference
    try { config.saveConfig({ sortMode }); } catch (_) { /* ignore */ }
    refreshList();
  }

  // ── Delete snippet (with undo) ──────────────────────────────────
  function deleteSelected() {
    if (tagPickerActive || deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    deleteConfirmActive = true;

    // Stronger guard: require typing snippet name
    const confirmInput = blessed.textbox({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 56,
      height: 3,
      border: { type: 'line', fg: THEME.error.fg },
      padding: { left: 1, right: 1 },
      style: { fg: THEME.item.fg, border: { fg: THEME.error.fg }, bg: THEME.footerBg },
      keys: true,
      inputOnFocus: true,
      label: { text: ` ${G.warn} Type "${safeTag(snippet.name)}" to delete `, side: 'left', fg: THEME.labelFg, bg: THEME.error.fg }
    });

    confirmInput.on('submit', (val) => {
      confirmInput.destroy();
      deleteConfirmActive = false;
      if ((val || '').trim() === snippet.name) {
        // Save for undo
        const deletedContent = storage.readSnippetContent(snippet);
        const deletedSnippet = { ...snippet };
        storage.deleteSnippetById(snippet.id);

        // Undo window
        if (_undoDelete && _undoDelete.timer) clearTimeout(_undoDelete.timer);
        _undoDelete = {
          snippet: deletedSnippet,
          content: deletedContent,
          timer: setTimeout(() => { _undoDelete = null; }, 5000)
        };

        flashHelp(` ${G.check} Deleted "${safeTag(snippet.name)}"  Press z to undo (5s) `, THEME.success, 5000);
        reloadAll();
      } else {
        flashHelp(` ${G.cross} Name didn't match. Delete cancelled. `, THEME.warning, 2000);
      }
      listBox.focus();
      screen.render();
    });

    confirmInput.on('cancel', () => {
      confirmInput.destroy();
      deleteConfirmActive = false;
      setHelpBarDefault();
      listBox.focus();
      screen.render();
    });

    confirmInput.focus();
    screen.render();
  }

  // Undo last delete
  function undoDelete() {
    if (!_undoDelete) return;
    const { snippet, content } = _undoDelete;
    clearTimeout(_undoDelete.timer);
    _undoDelete = null;
    try {
      storage.addSnippet({ name: snippet.name, content, language: snippet.language, tags: snippet.tags || [] });
      flashHelp(` ${G.usage} Restored "${safeTag(snippet.name)}" `, THEME.success, 2000);
      reloadAll();
    } catch (e) {
      flashHelp(` ${G.cross} Undo failed: ${e.message} `, THEME.error, 2600);
    }
  }

  function cancelDelete() {
    if (!deleteConfirmActive) return;
    deleteConfirmActive = false;
    setHelpBarDefault();
    screen.render();
  }

  // ── Inline editor modal ──────────────────────────────────────────────
  function showEditorModal(title, initialContent, onSave) {
    const { width, height } = getModalSize(screen, 70, 120, 18, 36);
    const modal = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width,
      height,
      border: { type: 'line', fg: THEME.accent.fg },
      style: { border: { fg: THEME.accent.fg }, bg: THEME.footerBg, fg: THEME.item.fg },
      tags: true,
      label: { text: ` ${G.dot} ${title} `, side: 'left', fg: THEME.labelFg, bg: THEME.accent.fg }
    });

    const editor = blessed.textarea({
      parent: modal,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-3',
      keys: true,
      mouse: true,
      inputOnFocus: true,
      scrollable: true,
      alwaysScroll: true,
      style: { fg: THEME.item.fg, bg: THEME.footerBg },
      scrollbar: { style: { bg: THEME.accent.fg } },
      value: initialContent
    });

    const footer = blessed.text({
      parent: modal,
      bottom: 0,
      left: 0,
      width: '100%',
      content: ` Ctrl+S:save  Esc:cancel  `,
      style: { fg: THEME.footerFg, bg: THEME.headerBg }
    });

    let isClosed = false;
    let escapeGuard = false; // UX: require double-Esc to discard changes
    function close(saved) {
      if (isClosed) return;
      isClosed = true;
      const content = (editor.getValue ? editor.getValue() : editor.value || '');
      modal.destroy();
      listBox.focus();
      screen.render();
      if (saved) onSave(content);
    }

    editor.key(['C-s'], () => close(true));
    editor.key(['escape'], () => {
      const current = (editor.getValue ? editor.getValue() : editor.value || '');
      if (current !== initialContent && !escapeGuard) {
        escapeGuard = true;
        footer.setContent(` ${G.warn} Unsaved changes. Press Esc again to discard. `);
        footer.style.fg = THEME.warning.fg;
        screen.render();
        return;
      }
      close(false);
    });

    editor.focus();
    screen.render();
  }

  // ── Metadata prompt (tags + language) — sequential single-input ─────
  function showMetaPrompt(defaultTags, defaultLang, onDone) {
    // Step 1: Tags
    promptSingleField('Tags (comma-separated)', defaultTags, (tags) => {
      if (tags === null) { onDone(null, null); return; }
      // Step 2: Language
      promptSingleField('Language (sh, bash, python, node)', defaultLang || 'sh', (lang) => {
        if (lang === null) {
          // Esc on language — still save tags
          const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
          onDone(tagArr, defaultLang || 'sh');
        } else {
          const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
          onDone(tagArr, lang || 'sh');
        }
      });
    });
  }

  function promptSingleField(label, defaultValue, cb) {
    const input = blessed.textbox({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 56,
      height: 3,
      border: { type: 'line', fg: THEME.accent.fg },
      padding: { left: 1, right: 1 },
      style: { fg: THEME.item.fg, border: { fg: THEME.accent.fg }, bg: THEME.footerBg },
      keys: true,
      inputOnFocus: true,
      value: defaultValue || '',
      label: { text: ` ${G.dot} ${label} `, side: 'left', fg: THEME.labelFg, bg: THEME.accent.fg }
    });

    input.on('submit', (val) => {
      input.destroy();
      listBox.focus();
      screen.render();
      cb((val || '').trim());
    });

    input.on('cancel', () => {
      input.destroy();
      listBox.focus();
      screen.render();
      cb(null);
    });

    input.focus();
    screen.render();
  }

  // ── Edit snippet ────────────────────────────────────────────────────
  function editSelected() {
    if (tagPickerActive || deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    const content = storage.readSnippetContent(snippet);
    showEditorModal(`Edit: ${snippet.name}`, content, (newContent) => {
      const contentChanged = newContent.trim() && newContent !== content;
      if (contentChanged) {
        storage.updateSnippetContent(snippet.id, newContent);
        flashHelp(` ${G.check} Updated "${safeTag(snippet.name)}"  Press m to edit tags/language `, THEME.success, 2800);
        reloadAll();
      } else {
        flashHelp(` No changes. `, THEME.muted, 1200);
      }
    });
  }

  // ── Edit metadata for selected snippet ──────────────────────────────
  function editMeta() {
    if (tagPickerActive || deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    const currentTags = (snippet.tags || []).join(', ');
    const currentLang = snippet.language || 'sh';
    showMetaPrompt(currentTags, currentLang, (tags, lang) => {
      if (tags !== null) {
        storage.updateSnippetMeta(snippet.id, { tags, language: lang });
        flashHelp(` ${G.check} Updated tags/language for "${safeTag(snippet.name)}" `, THEME.success, 1800);
        reloadAll();
      } else {
        flashHelp(` No changes. `, THEME.muted, 1200);
      }
    });
  }

  // ── Add snippet from TUI ────────────────────────────────────────────
  function addSnippet() {
    if (tagPickerActive || deleteConfirmActive) return;
    // Step 1: prompt for snippet name
    const nameInput = blessed.textbox({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 3,
      border: { type: 'line', fg: THEME.accent.fg },
      padding: { left: 1, right: 1 },
      style: { fg: THEME.item.fg, border: { fg: THEME.accent.fg }, bg: THEME.footerBg },
      keys: true,
      inputOnFocus: true,
      label: { text: ` ${G.dot} Snippet name `, side: 'left', fg: THEME.labelFg, bg: THEME.accent.fg }
    });

    nameInput.on('submit', (name) => {
      nameInput.destroy();
      name = (name || '').trim();
      if (!name) {
        flashHelp(` Cancelled — no name given. `, THEME.muted, 1200);
        listBox.focus();
        screen.render();
        return;
      }
      name = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      // Step 2: editor (empty — no placeholder)
      showEditorModal(`New: ${name}`, '', (content) => {
        if (!content.trim()) {
          flashHelp(` Cancelled — empty content. `, THEME.muted, 1200);
          return;
        }
        // Step 3: tags + language
        showMetaPrompt('', 'sh', (tags, lang) => {
          const finalTags = tags || [];
          const finalLang = lang || 'sh';
          storage.addSnippet({ name, content, language: finalLang, tags: finalTags });
          flashHelp(` ${G.check} Added "${name}" `, THEME.success, 2600);
          reloadAll();
        });
      });
    });

    nameInput.on('cancel', () => {
      nameInput.destroy();
      listBox.focus();
      screen.render();
    });

    nameInput.focus();
    screen.render();
  }

  // ── Event bindings ──────────────────────────────────────────────────
  searchBox.on('submit', () => {
    const raw = (searchBox.getValue ? searchBox.getValue() : searchBox.content || '').trim();
    searchQuery = raw.startsWith('/') ? raw.slice(1).trim() : raw;
    exitSearch();
    refreshList();
    screen.render();
  });

  searchBox.on('cancel', () => {
    // Revert to pre-search query
    exitSearch();
    updateHeader();
    updatePreview();
    screen.render();
  });

  // Incremental search: filter live on each keystroke
  searchBox.on('keypress', () => {
    if (!_searchMode) return;
    // Defer to next tick so searchBox value is updated
    setTimeout(() => {
      const raw = (searchBox.getValue ? searchBox.getValue() : searchBox.content || '').trim();
      searchQuery = raw.startsWith('/') ? raw.slice(1).trim() : raw;
      refreshList();
    }, 0);
  });

  listBox.on('select', (el, i) => {
    selectedIndex = i;
    updatePreview();
  });
  listBox.on('focus', () => {
    listBox.style.border = THEME.borderFocus;
    screen.render();
  });
  listBox.on('blur', () => {
    listBox.style.border = THEME.border;
    screen.render();
  });

  // Undo key
  listBox.key('z', () => undoDelete());

  listBox.key('r', () => {
    if (tagPickerActive || deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (!snippet) return;
    runSnippet(snippet, screen, (status) => {
      listBox.focus();
      if (status !== null && status !== undefined) showRunFeedback(screen, helpBar, status);
      else screen.render();
    });
  });

  listBox.key('c', () => copySelectedSnippet());
  listBox.key('t', () => { if (!deleteConfirmActive) toggleTagFilter(); });
  listBox.key('/', () => { if (!deleteConfirmActive) focusSearch(); });
  listBox.key('s', () => cycleSort());
  listBox.key('d', () => deleteSelected());
  listBox.key('e', () => editSelected());
  listBox.key('m', () => editMeta());
  listBox.key('a', () => addSnippet());

  listBox.key('?', () => {
    if (deleteConfirmActive) return;
    showHelpOverlay(screen, helpBar, () => {
      listBox.focus();
      setHelpBarDefault();
      screen.render();
    });
  });

  listBox.key(['j', 'down'], () => {
    if (deleteConfirmActive) return;
    selectRelative(1);
  });

  listBox.key(['k', 'up'], () => {
    if (deleteConfirmActive) return;
    selectRelative(-1);
  });

  listBox.key(['C-d', 'pagedown', 'J'], () => {
    if (deleteConfirmActive) return;
    selectRelative(FAST_MOVE_STEP);
  });

  listBox.key(['C-u', 'pageup', 'K'], () => {
    if (deleteConfirmActive) return;
    selectRelative(-FAST_MOVE_STEP);
  });

  listBox.key('g', () => {
    if (deleteConfirmActive) return;
    selectAbsolute(0);
  });

  listBox.key(['G'], () => {
    if (deleteConfirmActive) return;
    selectAbsolute(Math.max(0, filtered.length - 1));
  });

  listBox.key('enter', () => {
    if (deleteConfirmActive) return;
    const snippet = filtered[selectedIndex];
    if (snippet) showSnippet(snippet, screen, () => { listBox.focus(); updatePreview(); screen.render(); });
    screen.render();
  });

  function quit() {
    clearHelpTimer();
    screen.destroy();
    process.exit(0);
  }

  listBox.key(['q'], () => { if (deleteConfirmActive) { cancelDelete(); return; } quit(); });
  screen.key(['C-c'], () => quit());

  listBox.key(['escape'], () => {
    if (deleteConfirmActive) { cancelDelete(); return; }
    if (tagPickerActive) {
      tagPickerActive = false;
      setHelpBarDefault();
      screen.render();
    } else if (tagFilter) {
      tagFilter = null;
      refreshList();
    } else if (searchQuery) {
      searchQuery = '';
      refreshList();
    }
    screen.render();
  });

  // Handle resize to toggle split-pane
  function resizeLayout() {
    const lw = calcListWidth();
    const pw = calcPreviewWidth();
    searchBox.width = lw;
    listBox.width = lw;
    previewBox.width = pw;
  }
  screen.on('resize', () => {
    resizeLayout();
    refreshList();
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
