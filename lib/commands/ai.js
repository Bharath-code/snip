const storage = require('../storage');
const config = require('../config');
const { c } = require('../colors');
const icons = require('../icons');
const { actionHint } = require('../format');
const openaiProvider = require('../ai/openai');
const detectLanguage = require('../ai/detect');

/**
 * Generate a snippet using AI
 *
 * @param {string} prompt - The prompt describing what to generate
 * @param {Object} opts - Command options
 * @param {string} opts.lang - Target language (auto-detect if not specified)
 * @param {string} opts.tags - Comma-separated tags
 * @param {string} opts.name - Snippet name (auto-generated if not specified)
 * @param {string} opts.model - AI model to use
 */
async function generate(prompt, opts) {
  if (!prompt || prompt.trim().length === 0) {
    console.error(c.err('  Error: Prompt is required'));
    console.log(c.dim('  Usage: snip ai generate "<prompt>"'));
    process.exit(1);
    return;
  }

  const cfg = config.loadConfig();

  // Check for API key
  const apiKey = process.env.SNIP_AI_API_KEY || cfg.ai_api_key;
  if (!apiKey) {
    console.error(c.err('  Error: AI API key not configured'));
    console.log(c.dim('  Set SNIP_AI_API_KEY environment variable or run:'));
    console.log(c.code('  snip config set ai_api_key <your-key>'));
    process.exit(1);
    return;
  }

  // Parse options
  const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const model = opts.model || cfg.ai_model || 'gpt-3.5-turbo';
  let targetLang = opts.lang;

  // Show progress
  console.log(c.dim('  🤖 Generating snippet...'));

  try {
    // Generate content using OpenAI
    const content = await openaiProvider.generate({
      prompt,
      apiKey,
      model,
      maxTokens: cfg.ai_max_tokens || 1000,
      language: targetLang
    });

    // Auto-detect language if not specified
    if (!targetLang) {
      targetLang = detectLanguage(content, prompt);
    }

    // Generate name if not provided
    const name = opts.name || generateName(prompt);

    // Add snippet
    const snippet = storage.addSnippet({
      name,
      content: content.trim(),
      language: targetLang,
      tags: [...tags, 'ai-generated']
    });

    // Show success message
    console.log('');
    console.log(c.success('  ✓ Generated: ') + c.brand(snippet.name));
    console.log('');

    // Show snippet details
    const langIcon = icons.getLangIcon(snippet.language);
    const metaParts = [];
    if (snippet.language) metaParts.push(c.code(langIcon + ' ' + snippet.language));
    if (snippet.tags && snippet.tags.length) metaParts.push(c.tag(icons.tag + ' ' + snippet.tags.join(', ')));

    if (metaParts.length) {
      console.log(c.dim('  ') + metaParts.join(c.muted('  ·  ')));
    }

    // Show content preview
    const contentPreview = content.split('\n').slice(0, 3).join('\n');
    const displayContent = contentPreview.length > 60
      ? contentPreview.slice(0, 60) + '...'
      : contentPreview;

    console.log(c.dim('  ') + '─'.repeat(Math.min(40, (process.stdout.columns || 80) - 4)));
    console.log(c.code('  ' + displayContent));
    console.log('');

    // Action hints
    console.log(actionHint([
      'snip run ' + name + ':Run',
      'snip edit ' + name + ':Modify',
      'snip show ' + name + ':View',
    ]));

  } catch (err) {

    // Handle specific error types
    if (err.message.includes('401')) {
      console.error(c.err('  Error: Invalid API key'));
      console.log(c.dim('  Check your SNIP_AI_API_KEY or run: snip config set ai_api_key <key>'));
    } else if (err.message.includes('429')) {
      console.error(c.err('  Error: Rate limit exceeded'));
      console.log(c.dim('  Please try again in a few moments'));
    } else if (err.message.includes('timeout')) {
      console.error(c.err('  Error: Request timed out'));
      console.log(c.dim('  Please try again'));
    } else {
      console.error(c.err('  Error: ') + err.message);
    }
    process.exit(1);
  }
}

/**
 * Generate a kebab-case name from a prompt
 */
function generateName(prompt) {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/^-+|-+$/g, '') || 'ai-snippet';
}

module.exports = { generate };