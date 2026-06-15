/**
 * snip suggest — context-aware snippet suggestions.
 *
 * Examines the current directory for project context clues (Dockerfile,
 * package.json, Makefile, etc.) and surfaces the most relevant snippets.
 *
 * Usage:
 *   snip suggest                   # Show context-relevant snippets
 *   snip suggest --json            # Machine-readable output
 *   snip suggest --all             # Show all, scored (even 0-relevance)
 *   snip suggest --dir /path       # Analyze a different directory
 *   snip suggest --limit 5         # Show top 5
 *
 * Design: "snip watches what directory you're in and suggests relevant
 * snippets." — Wow #2 from strategic analysis.
 */

const storage = require('../storage');
const context = require('../context');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint, stripAnsi } = require('../format');
const { log } = require('../quiet');

// Category icons for context types
const CTX_ICONS = {
  node: '📦',
  npm: '📦',
  yarn: '📦',
  pnpm: '📦',
  typescript: '🔷',
  ts: '🔷',
  docker: '🐳',
  python: '🐍',
  ruby: '💎',
  rust: '🦀',
  cargo: '🦀',
  go: '🔶',
  golang: '🔶',
  java: '☕',
  php: '🐘',
  terraform: '🏗',
  k8s: '☸',
  kubernetes: '☸',
  helm: '☸',
  make: '⚒',
  git: '',
  ci: '⚡',
  'github-actions': '⚡',
  gitlab: '🦊',
  nix: '❄',
  vagrant: '💻',
  env: '🔐',
  config: '⚙',
  npm: '📦',
};

function getCtxIcon(tag) {
  return CTX_ICONS[tag] || '📁';
}

/**
 * Rank snippets by relevance to the current directory context.
 * Loads snippet content for content-based matching.
 */
function rankByContext(dir, opts = {}) {
  const ctx = context.detectContext(dir);
  const all = storage.listSnippets();

  const scored = all
    .map(s => {
      // Load content for content-based keyword matching
      const content = storage.readSnippetContent(s);
      const sWithContent = { ...s, content };
      return {
        snippet: s,
        score: context.scoreRelevance(sWithContent, ctx),
        reasons: computeReasons(sWithContent, ctx),
      };
    })
    .sort((a, b) => b.score - a.score);

  return { ctx, scored };
}

/**
 * Compute human-readable reasons why a snippet matched.
 */
function computeReasons(snippet, ctx) {
  const reasons = [];
  const snippetTags = (snippet.tags || []).map(t => t.toLowerCase());
  const lang = (snippet.language || '').toLowerCase();

  for (const ctxTag of ctx.tags) {
    if (snippetTags.includes(ctxTag)) {
      reasons.push(`tag:${ctxTag}`);
    } else if (snippetTags.some(t => t.includes(ctxTag) || ctxTag.includes(t))) {
      reasons.push(`related:${ctxTag}`);
    }
  }

  if (lang && ctx.tags.some(t => t === lang || t.includes(lang) || lang.includes(t))) {
    reasons.push('language');
  }

  const name = (snippet.name || '').toLowerCase();
  if (name.includes(ctx.projectName.toLowerCase())) {
    reasons.push('project-name');
  }

  if (snippet.usageCount > 5) reasons.push('popular');

  return reasons;
}

/**
 * snip suggest command handler.
 */
function suggestCmd(opts = {}) {
  const dir = opts.dir || process.cwd();
  const limit = Math.max(1, Math.min(parseInt(opts.limit) || 10, 50));
  const { ctx, scored } = rankByContext(dir);

  // Apply threshold unless --all
  const relevant = opts.all
    ? scored
    : scored.filter(s => s.score > 0);

  const display = relevant.slice(0, limit);

  // ── JSON output ──
  if (opts.json) {
    const out = {
      context: {
        projectType: ctx.projectType,
        projectName: ctx.projectName,
        tags: ctx.tags,
        files: ctx.files,
        git: ctx.gitRemote ? { org: ctx.gitRemote.org, repo: ctx.gitRemote.repo } : null,
        branch: ctx.branch,
      },
      suggestions: display.map(s => ({
        name: s.snippet.name,
        language: s.snippet.language,
        tags: s.snippet.tags,
        relevance: s.score,
        reasons: s.reasons,
        usageCount: s.snippet.usageCount || 0,
      })),
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // ── Terminal output ──
  const cols = Math.min(process.stdout.columns || 80, 72);

  log('');
  log(c.border('  ┌' + '─'.repeat(cols - 2) + '┐'));

  // Header
  const ctxTagsStr = ctx.tags.length
    ? ctx.tags.map(t => c.code(getCtxIcon(t) + ' ' + t)).join(c.dim(' '))
    : c.dim('(general)');
  const headerStr = ` ${c.brand('📋 Suggestions for')} ${c.path(ctx.projectName)}  ${ctxTagsStr}`;
  const headerPadding = Math.max(0, cols - 2 - stripAnsi(headerStr).length - 1);
  log(c.border('  │') + headerStr + ' '.repeat(headerPadding) + c.border('│'));

  // Context files line
  if (ctx.files.length) {
    const filesStr = c.muted('  Files: ') + ctx.files.map(f => c.path(f)).join(c.dim(', '));
    const filesPadding = Math.max(0, cols - 2 - stripAnsi(filesStr).length - 1);
    log(c.border('  │') + filesStr + ' '.repeat(filesPadding) + c.border('│'));
  }

  log(c.border('  ├' + '─'.repeat(cols - 2) + '┤'));

  if (display.length === 0) {
    const emptyStr = c.muted('  No relevant snippets found for this context.');
    const emptyPadding = Math.max(0, cols - 2 - stripAnsi(emptyStr).length - 1);
    log(c.border('  │') + emptyStr + ' '.repeat(emptyPadding) + c.border('│'));
    log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));
    log('');
    log(c.dim('  Tip: Save project-specific snippets with matching tags,'));
    log(c.dim('  e.g. ') + c.code('echo "kubectl get pods" | snip add k8s-pods --lang sh --tags k8s'));
    log('');
    return;
  }

  // Results
  display.forEach((item, i) => {
    const s = item.snippet;
    const score = item.score;
    const reasons = item.reasons;

    // Score bar
    const barWidth = 14;
    const filled = Math.round((score / 100) * barWidth);
    const scoreBar = c.brand('█'.repeat(filled)) + c.dim('░'.repeat(barWidth - filled));

    // Name, lang, tags
    const idx = c.dim(String(i + 1).padStart(2));
    const name = c.brand(s.name);
    const langIcon = icons.getLangIcon(s.language);
    const lang = s.language ? c.code(langIcon + ' ' + s.language) : '';
    const tags = (s.tags || []).length
      ? c.tag((s.tags || []).slice(0, 3).join(', ') + ((s.tags || []).length > 3 ? '...' : ''))
      : '';
    const usage = s.usageCount ? c.dim('[' + s.usageCount + ']') : '';

    // Reason badges
    const reasonBadges = reasons.slice(0, 3).map(r => {
      if (r.startsWith('tag:')) return c.code(r.slice(4));
      if (r.startsWith('related:')) return c.muted(r.slice(8));
      if (r === 'language') return c.dim('lang');
      if (r === 'project-name') return c.path('project');
      if (r === 'popular') return c.fire('popular');
      return c.dim(r);
    });

    log('  ' + idx + ' ' + scoreBar + ' ' + c.muted(String(score).padStart(2) + '%') + '  ' + name + (lang ? ' ' + lang : ''));
    const metaLine = '     ' + c.muted(' '.repeat(barWidth + 6)) + (tags ? tags + ' ' : '') + (usage ? usage + ' ' : '') + reasonBadges.join(' ');
    log(metaLine);
  });

  log(c.border('  └' + '─'.repeat(cols - 2) + '┘'));

  // Summary
  log('');
  const matchCount = display.length;
  log(c.dim(`  ${ctx.projectType !== 'unknown' ? ctx.projectType : 'General'} context — ${matchCount} relevant snippet${matchCount === 1 ? '' : 's'}`));

  // Action hints
  log(actionHint([
    'snip run <name>:Run',
    'snip search <query>:Find more',
    'snip add <name>:Save new',
  ]));
  log('');
}

module.exports = suggestCmd;
