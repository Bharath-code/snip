#!/usr/bin/env node

/**
 * snip MCP Server — exposes snip's snippet library to AI agents
 * via the Model Context Protocol (MCP).
 *
 * Tools:
 *   snip_search  - Search snippets by query
 *   snip_list    - List all snippets with optional filters
 *   snip_read    - Read a snippet's content by name
 *   snip_save    - Save a new snippet
 *   snip_edit    - Update a snippet's content, language, or tags
 *   snip_delete  - Delete a snippet by name
 *   snip_rename  - Rename a snippet
 *   snip_exec    - Execute a snippet (dry-run by default for safety)
 *
 * Resources:
 *   snip://snippets           - List all snippets
 *   snip://snippets/{name}    - Get a specific snippet with content
 *
 * Usage:
 *   node lib/mcp-server.js          # Start MCP server via stdio
 *   snip mcp                        # Same, from the CLI
 */

const { version } = require('../package.json');
const storage = require('./storage');
const search = require('./search');
const exec = require('./exec');
const config = require('./config');
const safety = require('./safety');
const context = require('./context');
const versions = require('./versions');
const diff = require('./diff');
const gist = require('./sync/gist');
const policy = require('./policy');
const audit = require('./audit');
const approvals = require('./approvals');
const { setExitCode } = require('./cli-utils');

// Lazy-loaded SDK — loaded only when createServer() is called, so tests
// that require this module don't need @modelcontextprotocol/sdk resolved.
let _sdk = null;
function getSdk() {
  if (!_sdk) {
    const path = require('path');
    const { createRequire } = require('module');
    // @modelcontextprotocol/sdk is "type": "module" with an exports field that
    // prevents resolving deep paths from CJS. createRequire bypasses the exports
    // map by loading via relative paths from within the package.
    const r = createRequire(require.resolve('@modelcontextprotocol/sdk/server'));
    _sdk = {
      Server: r('./index.js').Server,
      StdioServerTransport: r('./stdio.js').StdioServerTransport,
      ListToolsRequestSchema: r('../types.js').ListToolsRequestSchema,
      CallToolRequestSchema: r('../types.js').CallToolRequestSchema,
      ListResourcesRequestSchema: r('../types.js').ListResourcesRequestSchema,
      ReadResourceRequestSchema: r('../types.js').ReadResourceRequestSchema,
    };
  }
  return _sdk;
}

// ── Tool schemas (JSON Schema for AI agent parameter validation) ──

const TOOLS = [
  {
    name: 'snip_search',
    description: 'Fuzzy-search snippets by name, tags, or content. Returns matching snippet metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (fuzzy matched against name, tags, content)' },
        limit: { type: 'number', description: 'Max results (default: 10, max: 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'snip_searchRelevance',
    description: 'Search snippets with Fuse.js relevance scores. Returns results ranked by match quality — lower score = better match (0 = perfect, 1 = no match). Content-aware: matches against name, snippet body, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (fuzzy matched against name, tags, content)' },
        limit: { type: 'number', description: 'Max results (default: 15, max: 100)' },
        min_score: { type: 'number', description: 'Minimum relevance score threshold (0-1). Only return results with score <= this value. Lower = stricter filtering. Default: no filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'snip_list',
    description: 'List all snippets with optional filters for tag, language, and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Filter by tag (exact match)' },
        lang: { type: 'string', description: 'Filter by language (e.g., bash, python, js)' },
        sort: { type: 'string', enum: ['name', 'usage', 'recent'], description: 'Sort order (default: name)' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
    },
  },
  {
    name: 'snip_read',
    description: "Read a snippet's full content and metadata by name or ID.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID to read' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_save',
    description: 'Save a new snippet to your personal library. Language is auto-detected from content.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name (kebab-case, e.g., docker-cleanup)' },
        content: { type: 'string', description: 'The snippet code/command content' },
        language: { type: 'string', description: 'Language (sh, bash, python, js, ts, go, etc.). Auto-detected if omitted.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for organization (optional)' },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'snip_edit',
    description: 'Update an existing snippet\'s content, language, or tags. All fields except name are optional — only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID to edit' },
        content: { type: 'string', description: 'New snippet content (replaces existing)' },
        language: { type: 'string', description: 'New language (e.g., sh, bash, python, js, ts, go)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags array (replaces existing)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_delete',
    description: 'Permanently delete a snippet by name or ID. This cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID to delete' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_rename',
    description: 'Rename an existing snippet. Takes the current name and a new name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current snippet name or ID' },
        new_name: { type: 'string', description: 'New name for the snippet' },
      },
      required: ['name', 'new_name'],
    },
  },
  {
    name: 'snip_suggest',
    description: 'Get context-aware snippet suggestions based on the current directory. Examines project files (Dockerfile, package.json, etc.) and returns ranked snippets with relevance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max suggestions (default: 10)' },
        all: { type: 'boolean', description: 'Include 0-relevance snippets' },
      },
    },
  },
  {
    name: 'snip_history',
    description: 'Show version history for a snippet. Returns a list of versions with timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID' },
        limit: { type: 'number', description: 'Max versions to show (default: all)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_diff',
    description: 'Diff two versions of a snippet. Version can be a number, "prev", or "current".',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID' },
        version_a: { type: 'string', description: 'First version (number, "prev", or "current")', default: 'prev' },
        version_b: { type: 'string', description: 'Second version (number, "prev", or "current")', default: 'current' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_undo',
    description: 'Rollback a snippet to its previous version. Returns the restored content.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID to undo' },
        version: { type: 'number', description: 'Specific version to restore (optional — defaults to previous)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_exec',
    description: 'Execute a snippet by name. Dry-run mode is default — set dry_run: false to actually run it. Execution is governed by .snip/policy.json (deny/allow patterns, language allowlist, max runtime) plus built-in safety rules; policies may require human approval via `snip approve <id>`. Every call is written to the audit log.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name or ID to execute' },
        dry_run: { type: 'boolean', description: 'If true, only show what would run (default: true for safety)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'snip_share',
    description: 'Publish a snippet (or multiple snippets as a pack) as a public GitHub Gist. Requires a GitHub token configured via SNIP_GIST_TOKEN env var or snip config set gist_token.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name to share as a single public Gist' },
        names: { type: 'array', items: { type: 'string' }, description: 'Multiple snippet names to share as a pack (all in one Gist). Use instead of "name" for packs.' },
      },
    },
  },
  {
    name: 'snip_discover',
    description: 'Search public GitHub Gists for community-shared snippets. Supports keyword search (requires token) or browsing recent public gists (works without token).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to find code in public gists (requires GitHub token)' },
        recent: { type: 'boolean', description: 'If true, browse recent public gists instead of searching. Works without a token.' },
        lang: { type: 'string', description: 'Filter by language (e.g., bash, python, js, go). Works with both search and --recent.' },
        snip_only: { type: 'boolean', description: 'When used with --recent, only show gists with "snip:" in their description (community-shared snippets).' },
        limit: { type: 'number', description: 'Max results (default: 15 for search, 30 for --recent)' },
      },
    },
  },
  {
    name: 'snip_unshare',
    description: 'Delete a shared Gist (unpublish a previously shared snippet). Removes the remote Gist while keeping the local snippet. Requires a GitHub token configured via SNIP_GIST_TOKEN env var or snip config set gist_token.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Snippet name to unpublish. The snippet must have a previously shared Gist (have its origin.gistId set).' },
      },
      required: ['name'],
    },
  },
];

// ── Create the MCP Server instance ──

function createServer() {
  const sdk = getSdk();
  const server = new sdk.Server(
    { name: 'snip-mcp', version },
    { capabilities: { tools: {}, resources: {} } }
  );

  // ── Tool Handlers ──

  server.setRequestHandler(sdk.ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(sdk.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Every tool call is appended to <dataDir>/audit.jsonl. Handlers can
    // attach extra fields (dryRun, blocked, exitCode...) via result._audit.
    const logAndReturn = (result) => {
      const extra = result && result._audit;
      if (result) delete result._audit;
      audit.append({ tool: name, args, isError: !!(result && result.isError), ...extra });
      return result;
    };

    try {
      return logAndReturn(await dispatchTool(name, args));
    } catch (err) {
      return logAndReturn({
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  });

  async function dispatchTool(name, args) {
    switch (name) {
        case 'snip_search':
          return handleSearch(args);
        case 'snip_searchRelevance':
          return handleSearchRelevance(args);
        case 'snip_list':
          return handleList(args);
        case 'snip_read':
          return handleRead(args);
        case 'snip_save':
          return handleSave(args);
        case 'snip_edit':
          return handleEdit(args);
        case 'snip_delete':
          return handleDelete(args);
        case 'snip_rename':
          return handleRename(args);
        case 'snip_suggest':
          return handleSuggest(args);
        case 'snip_history':
          return handleHistory(args);
        case 'snip_diff':
          return handleDiff(args);
        case 'snip_undo':
          return handleUndo(args);
        case 'snip_share':
          return handleShare(args);
        case 'snip_discover':
          return handleDiscover(args);
        case 'snip_unshare':
          return handleUnshare(args);
        case 'snip_exec':
          return handleExec(args);
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
    }
  }

  // ── Resource Handlers ──

  server.setRequestHandler(sdk.ListResourcesRequestSchema, async () => {
    const snippets = storage.listSnippets();
    return {
      resources: snippets.map(s => ({
        uri: `snip://snippets/${encodeURIComponent(s.name)}`,
        name: s.name,
        description: `[${s.language || '?'}] ${(s.tags || []).join(', ')}`,
        mimeType: 'text/plain',
      })),
    };
  });

  server.setRequestHandler(sdk.ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^snip:\/\/snippets\/(.+)$/);

    if (!match) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    const name = decodeURIComponent(match[1]);
    const snippet = storage.getSnippetByIdOrName(name);

    if (!snippet) {
      throw new Error(`Snippet not found: ${name}`);
    }

    const content = storage.readSnippetContent(snippet);

    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: content || '',
        metadata: {
          name: snippet.name,
          language: snippet.language,
          tags: snippet.tags,
          usageCount: snippet.usageCount,
          createdAt: snippet.createdAt,
          updatedAt: snippet.updatedAt,
        },
      }],
    };
  });

  return server;
}

// ── Tool Implementations ──

function handleSearch(args) {
  const query = String(args.query || '').trim();
  const limit = Math.min(parseInt(args.limit) || 10, 50);

  if (!query) {
    return {
      content: [{ type: 'text', text: JSON.stringify([], null, 2) }],
    };
  }

  const results = search.search(query, limit);
  const snippets = results.map(r => {
    const s = storage.getSnippetByIdOrName(r.id);
    return s ? {
      id: s.id,
      name: s.name,
      language: s.language,
      tags: s.tags,
      usageCount: s.usageCount,
    } : r;
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(snippets, null, 2) }],
  };
}

function handleSearchRelevance(args) {
  const query = String(args.query || '').trim();
  const limit = Math.min(parseInt(args.limit) || 15, 100);
  const minScore = args.min_score !== undefined ? parseFloat(args.min_score) : undefined;

  if (!query) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'query is required' }, null, 2) }],
      isError: true,
    };
  }

  const rawResults = search.searchWithScores(query, limit);

  // Filter by min_score if provided
  let filtered = rawResults;
  if (minScore !== undefined && !isNaN(minScore)) {
    filtered = rawResults.filter(r => r.score <= minScore);
  }

  const results = filtered.map(r => {
    const s = storage.getSnippetByIdOrName(r.item.id);
    return {
      name: r.item.name,
      score: r.score,
      tags: r.item.tags ? r.item.tags.split(' ') : [],
      language: s ? s.language : null,
      usageCount: s ? s.usageCount : 0,
      snippetContent: r.item.content || '',
    };
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        query,
        total: results.length,
        maxScore: results.length > 0 ? results[results.length - 1].score : null,
        results,
      }, null, 2),
    }],
  };
}

function handleList(args) {
  let snippets = storage.listSnippets();

  if (args.tag) {
    snippets = snippets.filter(s => (s.tags || []).includes(args.tag));
  }
  if (args.lang) {
    const lang = args.lang.toLowerCase();
    snippets = snippets.filter(s => (s.language || '').toLowerCase() === lang);
  }

  const sort = args.sort || 'name';
  if (sort === 'usage') {
    snippets.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  } else if (sort === 'recent') {
    snippets.sort((a, b) => {
      const aTs = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
      const bTs = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
      return bTs - aTs;
    });
  } else {
    snippets.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  const limit = Math.min(parseInt(args.limit) || 50, 500);
  snippets = snippets.slice(0, limit);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(snippets.map(s => ({
        id: s.id,
        name: s.name,
        language: s.language,
        tags: s.tags,
        usageCount: s.usageCount,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })), null, 2),
    }],
  };
}

function handleRead(args) {
  const name = String(args.name || '').trim();

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name is required' }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);

  if (!snippet) {
    const suggestions = search.suggestSimilar(name, 3);
    const hint = suggestions.length
      ? ` Did you mean: ${suggestions.join(', ')}?`
      : '';
    return {
      content: [{ type: 'text', text: `Snippet not found: "${name}".${hint}` }],
      isError: true,
    };
  }

  const content = storage.readSnippetContent(snippet);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        id: snippet.id,
        name: snippet.name,
        language: snippet.language,
        tags: snippet.tags,
        usageCount: snippet.usageCount,
        content: content || '',
        createdAt: snippet.createdAt,
        updatedAt: snippet.updatedAt,
        lastUsedAt: snippet.lastUsedAt,
      }, null, 2),
    }],
  };
}

function handleSave(args) {
  const name = String(args.name || '').trim();
  const content = String(args.content || '').trim();

  if (!name || !content) {
    return {
      content: [{ type: 'text', text: 'Error: name and content are required' }],
      isError: true,
    };
  }

  let language = args.language || '';
  if (!language) {
    const { detectLanguageFromCommand } = require('./language-detect');
    language = detectLanguageFromCommand(content);
  }

  const userTags = Array.isArray(args.tags) ? args.tags : [];

  // Auto-tag with context (shared with CLI add command)
  let allTags = userTags;
  try {
    const { autoTagSnippet } = require('./command-utils');
    const result = autoTagSnippet(userTags);
    allTags = result.allTags;
  } catch (_) { /* context detection is best-effort */ }

  try {
    const snippet = storage.addSnippet({ name, content, language, tags: allTags });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: snippet.id,
          name: snippet.name,
          language: snippet.language,
          tags: snippet.tags,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Failed to save snippet: ${err.message}` }],
      isError: true,
    };
  }
}

function handleSuggest(args) {
  const limit = Math.min(parseInt(args.limit) || 10, 50);
  const ctx = context.detectContext();
  const all = storage.listSnippets();

  const scored = all
    .map(s => ({
      name: s.name,
      language: s.language,
      tags: s.tags,
      usageCount: s.usageCount || 0,
      relevance: context.scoreRelevance(s, ctx),
    }))
    .sort((a, b) => b.relevance - a.relevance);

  const filtered = args.all ? scored : scored.filter(s => s.relevance > 0);
  const suggestions = filtered.slice(0, limit);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        context: {
          projectType: ctx.projectType,
          projectName: ctx.projectName,
          tags: ctx.tags,
          files: ctx.files,
        },
        suggestions,
      }, null, 2),
    }],
  };
}

function handleHistory(args) {
  const name = String(args.name || '').trim();
  if (!name) {
    return { content: [{ type: 'text', text: 'Error: name is required' }], isError: true };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return { content: [{ type: 'text', text: `Snippet not found: "${name}"` }], isError: true };
  }

  const allVersions = versions.listVersions(snippet.id);
  const limit = Math.min(parseInt(args.limit) || allVersions.length, 50);
  const displayVersions = allVersions.slice(-limit).reverse();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        snippet: snippet.name,
        snippetId: snippet.id,
        currentVersion: versions.getLatestVersion(snippet.id),
        totalVersions: allVersions.length,
        versions: displayVersions.map(v => ({
          version: v.version,
          timestamp: v.timestamp,
          message: v.message,
          date: new Date(v.timestamp).toLocaleString(),
        })),
      }, null, 2),
    }],
  };
}

function handleDiff(args) {
  const name = String(args.name || '').trim();
  if (!name) {
    return { content: [{ type: 'text', text: 'Error: name is required' }], isError: true };
  }

  const { computeDiff } = require('./command-utils');
  const versionA = args.version_a || 'prev';
  const versionB = args.version_b || 'current';

  const diffResult = computeDiff(name, versionA, versionB);
  if (diffResult.error) {
    return { content: [{ type: 'text', text: diffResult.error }], isError: true };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        snippet: diffResult.snippet.name,
        labelA: diffResult.labelA,
        labelB: diffResult.labelB,
        stats: { added: diffResult.result.added, removed: diffResult.result.removed, unchanged: diffResult.result.unchanged },
        changes: diff.formatDiffJSON(diffResult.result),
      }, null, 2),
    }],
  };
}

function handleUndo(args) {
  const name = String(args.name || '').trim();
  if (!name) {
    return { content: [{ type: 'text', text: 'Error: name is required' }], isError: true };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return { content: [{ type: 'text', text: `Snippet not found: "${name}"` }], isError: true };
  }

  const allVersions = versions.listVersions(snippet.id);
  if (allVersions.length === 0) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'No version history. Nothing to undo.' }) }], isError: true };
  }

  let result;
  if (args.version !== undefined) {
    const targetVersion = parseInt(args.version);
    if (isNaN(targetVersion)) {
      return { content: [{ type: 'text', text: `Invalid version: ${args.version}` }], isError: true };
    }
    const targetContent = versions.getVersionContent(snippet.id, targetVersion);
    if (targetContent === null) {
      return { content: [{ type: 'text', text: `Version ${targetVersion} not found.` }], isError: true };
    }
    versions.saveVersion(snippet.id, 'Before rollback');
    storage.updateSnippetContent(snippet.id, targetContent);
    result = { content: targetContent, version: targetVersion, previousVersion: versions.getLatestVersion(snippet.id) };
  } else {
    result = versions.undo(snippet.id);
  }

  if (!result) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'Nothing to undo.' }) }], isError: true };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        snippet: snippet.name,
        restoredVersion: result.version,
        previousVersion: result.previousVersion,
        content: result.content,
      }, null, 2),
    }],
  };
}

function handleExec(args) {
  const name = String(args.name || '').trim();
  const dryRun = args.dry_run !== false;

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name is required' }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return {
      content: [{ type: 'text', text: `Snippet not found: "${name}"` }],
      isError: true,
    };
  }

  const content = storage.readSnippetContent(snippet);
  if (!content || !content.trim()) {
    return {
      content: [{ type: 'text', text: `Snippet "${name}" is empty.` }],
      isError: true,
    };
  }

  const pol = policy.loadPolicy();
  const check = policy.checkExec(content, snippet.language, pol);

  if (dryRun) {
    const cfg = config.loadConfig();
    const runner = exec.resolveRunner(snippet.language, cfg.defaultShell);
    return {
      _audit: { dryRun: true, blocked: check.blocked },
      content: [{
        type: 'text',
        text: JSON.stringify({
          snippet: snippet.name,
          language: snippet.language,
          runner: runner.command,
          content,
          blocked: check.blocked,
          blockedReason: check.reason,
          requiresApproval: check.requiresApproval,
          policySource: pol.source || 'built-in safety rules only',
          dryRun: true,
          message: 'DRY RUN — set dry_run: false to execute',
        }, null, 2),
      }],
    };
  }

  if (check.blocked) {
    return {
      _audit: { dryRun: false, blocked: true, reason: check.reason },
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Execution blocked by policy',
          snippet: snippet.name,
          reason: check.reason,
          policySource: pol.source || 'built-in safety rules',
          content,
          message: 'Use the CLI directly if a human needs to override this.',
        }, null, 2),
      }],
      isError: true,
    };
  }

  if (check.requiresApproval) {
    const pending = approvals.create({
      snippet: snippet.name,
      content,
      language: snippet.language,
    });
    return {
      _audit: { dryRun: false, pendingApproval: pending.id },
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'pending_approval',
          approvalId: pending.id,
          snippet: snippet.name,
          message: `Policy requires human approval. Ask the user to run: snip approve ${pending.id}`,
        }, null, 2),
      }],
    };
  }

  const cfg = config.loadConfig();
  const status = exec.runSnippetContent(content, {
    dryRun: false,
    shell: cfg.defaultShell,
    language: snippet.language,
    timeout: check.maxRuntimeMs || undefined,
  });

  if (status === 0) {
    storage.touchUsage(snippet);
    const { recordUsage } = require('./streak');
    recordUsage();
  }

  return {
    _audit: { dryRun: false, blocked: false, exitCode: status },
    content: [{
      type: 'text',
      text: JSON.stringify({
        snippet: snippet.name,
        exitCode: status,
        success: status === 0,
      }, null, 2),
    }],
  };
}

function handleEdit(args) {
  const name = String(args.name || '').trim();

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name is required' }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return {
      content: [{ type: 'text', text: `Snippet not found: "${name}"` }],
      isError: true,
    };
  }

  // Update metadata (tags, language, or both)
  const meta = {};
  if (args.language !== undefined) {
    meta.language = String(args.language);
  }
  if (args.tags !== undefined) {
    meta.tags = Array.isArray(args.tags) ? args.tags : [];
  }
  if (Object.keys(meta).length > 0) {
    storage.updateSnippetMeta(snippet.id, meta);
  }

  // Update content if provided
  if (args.content !== undefined && args.content !== null) {
    const newContent = String(args.content);
    storage.updateSnippetContent(snippet.id, newContent);
  }

  // Re-read to return fresh state
  const updated = storage.getSnippetByIdOrName(name) || snippet;
  const updatedContent = storage.readSnippetContent(updated);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        id: updated.id,
        name: updated.name,
        language: updated.language,
        tags: updated.tags,
        content: updatedContent || '',
        updatedAt: updated.updatedAt,
      }, null, 2),
    }],
  };
}

function handleDelete(args) {
  const name = String(args.name || '').trim();

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name is required' }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return {
      content: [{ type: 'text', text: `Snippet not found: "${name}"` }],
      isError: true,
    };
  }

  const deletedName = snippet.name;
  storage.deleteSnippetById(snippet.id);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        deleted: true,
        name: deletedName,
        message: `Snippet "${deletedName}" has been deleted.`,
      }, null, 2),
    }],
  };
}

function handleRename(args) {
  const name = String(args.name || '').trim();
  const newName = String(args.new_name || '').trim();

  if (!name || !newName) {
    return {
      content: [{ type: 'text', text: 'Error: name and new_name are required' }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return {
      content: [{ type: 'text', text: `Snippet not found: "${name}"` }],
      isError: true,
    };
  }

  // Check if new name already exists
  const existing = storage.getSnippetByIdOrName(newName);
  if (existing) {
    return {
      content: [{ type: 'text', text: `A snippet named "${newName}" already exists.` }],
      isError: true,
    };
  }

  const oldName = snippet.name;
  storage.updateSnippetMeta(snippet.id, { name: newName });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        renamed: true,
        old_name: oldName,
        new_name: newName,
        message: `Snippet "${oldName}" renamed to "${newName}".`,
      }, null, 2),
    }],
  };
}

async function handleDiscover(args) {
  const { getGistToken } = require('./command-utils');
  const { token } = getGistToken({ required: false });

  // ── Recent mode: browse public gists (works without token) ──
  if (args.recent) {
    try {
      const gists = await gist.listRecentGists(token, { limit: args.limit || 30 });

      if (!gists || gists.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ items: [], total_count: 0 }, null, 2) }],
        };
      }

      // Filter to "snip:" descriptions if snip_only is set
      let filtered = gists;
      if (args.snip_only) {
        filtered = gists.filter(g => g.description && g.description.toLowerCase().startsWith('snip:'));
      }

      const items = filtered.map(g => ({
        id: g.id,
        description: g.description || '',
        url: g.html_url || `https://gist.github.com/${g.id}`,
        files: g.files ? Object.keys(g.files) : [],
        owner: g.owner ? g.owner.login : 'anonymous',
        created: g.created_at,
        importCommand: `snip sync pull ${g.id}`,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ items, total_count: items.length }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Failed to list gists: ${err.message}` }, null, 2),
        }],
        isError: true,
      };
    }
  }

  // ── Search mode: requires a query ──
  const query = String(args.query || '').trim();

  if (!query) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'No search query provided',
          message: 'Provide a "query" to search, or set "recent": true to browse recent public gists.',
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Search requires a token
  if (!token) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'GitHub token not configured',
          message: 'GitHub Code Search requires authentication. Set SNIP_GIST_TOKEN env var or run: snip config set gist_token <your-token>',
          hint: 'Use "recent": true to browse public gists without a token.',
        }, null, 2),
      }],
      isError: true,
    };
  }

  try {
    const results = await gist.searchCodeGists(query, token, {
      lang: args.lang,
      limit: args.limit || 15,
    });

    const items = (results.items || []).map(item => {
      const htmlUrl = item.html_url || '';
      const gistMatch = htmlUrl.match(/gist\.github\.com\/([a-f0-9]+)/);
      const gistId = gistMatch ? gistMatch[1] : '';
      return {
        name: item.name,
        path: item.path,
        gistId,
        url: htmlUrl,
        repository: item.repository ? item.repository.full_name : '',
        score: item.score,
        importCommand: gistId ? `snip sync pull ${gistId}` : undefined,
      };
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_count: results.total_count || 0,
          items,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Discover failed: ${err.message}` }, null, 2),
      }],
      isError: true,
    };
  }
}

async function handleShare(args) {
  const { getGistToken } = require('./command-utils');
  const { token, error: tokenError } = getGistToken();

  if (tokenError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'GitHub token not configured',
        message: 'Set SNIP_GIST_TOKEN env var or run: snip config set gist_token <your-token>',
      }, null, 2) }],
      isError: true,
    };
  }

  // Accept either a single name or a names array
  const snippetNames = [];
  if (args.names && Array.isArray(args.names) && args.names.length > 0) {
    snippetNames.push(...args.names.map(n => String(n).trim()).filter(Boolean));
  } else if (args.name) {
    snippetNames.push(String(args.name).trim());
  }

  if (snippetNames.length === 0) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'No snippet name provided',
        message: 'Provide a "name" (single snippet) or "names" array (multiple snippets as a pack).',
      }, null, 2) }],
      isError: true,
    };
  }

  try {
    let result;

    if (snippetNames.length === 1) {
      // Validate single snippet exists
      const name = snippetNames[0];
      if (!storage.getSnippetByIdOrName(name)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: `Snippet not found: "${name}"`,
          }, null, 2) }],
          isError: true,
        };
      }
      result = await gist.shareSnippet(name, token);
    } else {
      // Validate all snippets exist before creating pack
      const notFound = [];
      for (const n of snippetNames) {
        if (!storage.getSnippetByIdOrName(n)) notFound.push(n);
      }
      if (notFound.length > 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: `Snippets not found: ${notFound.join(', ')}`,
          }, null, 2) }],
          isError: true,
        };
      }
      result = await gist.sharePack(snippetNames, token);
    }

    const gistUrl = result.html_url || `https://gist.github.com/${result.id}`;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          url: gistUrl,
          gistId: result.id,
          description: result.description,
          files: Object.keys(result.files || {}),
          importCommand: `snip sync pull ${result.id}`,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Share failed: ${err.message}`,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

async function handleUnshare(args) {
  const { getGistToken } = require('./command-utils');
  const { token, error: tokenError } = getGistToken();

  if (tokenError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'GitHub token not configured',
        message: 'Set SNIP_GIST_TOKEN env var or run: snip config set gist_token <your-token>',
      }, null, 2) }],
      isError: true,
    };
  }

  const name = String(args.name || '').trim();

  if (!name) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'Snippet name is required',
        message: 'Provide the "name" of a previously shared snippet to unpublish.',
      }, null, 2) }],
      isError: true,
    };
  }

  const snippet = storage.getSnippetByIdOrName(name);
  if (!snippet) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: `Snippet not found: "${name}"`,
      }, null, 2) }],
      isError: true,
    };
  }

  const gistId = snippet.origin && snippet.origin.gistId;
  if (!gistId) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: `Snippet "${name}" has no shared Gist to unpublish`,
        hint: `Share it first with snip_share.`,
      }, null, 2) }],
      isError: true,
    };
  }

  try {
    await gist.deleteGist(gistId, token);

    // Clear the origin data on the local snippet
    storage.setSnippetOrigin(snippet.id, {});

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          unpublished: true,
          snippet: snippet.name,
          gistId: gistId,
          message: `Gist ${gistId} deleted. The snippet remains in your local library.`,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Unpublish failed: ${err.message}`,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

// ── Start Server ──

async function start() {
  const server = createServer();
  const sdk = getSdk();
  const transport = new sdk.StdioServerTransport();
  await server.connect(transport);
  return server;
}

// If run directly (node lib/mcp-server.js or snip mcp)
if (require.main === module) {
  start().catch((err) => {
    console.error('MCP server error:', err);
    setExitCode(1);
  });
}

module.exports = { start, createServer, TOOLS };
