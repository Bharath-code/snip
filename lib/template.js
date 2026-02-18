/**
 * Template engine for parameterized snippets.
 *
 * Syntax:
 *   {{name}}           — required variable, prompts user
 *   {{name:default}}   — variable with default value
 *   {{name:$ENV_VAR}}  — variable with default from environment
 *
 * Example:
 *   docker run --rm -it {{image:ubuntu:24.04}} {{cmd:bash}}
 */

// F2: Use a factory instead of a shared stateful global regex
// A module-level /g regex retains lastIndex across calls and causes subtle bugs
const VAR_PATTERN = '\\{\\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\\}\\}';
function makeVarRe() { return new RegExp(VAR_PATTERN, 'g'); }
// Keep VAR_RE exported for backward compat (tests use it)
const VAR_RE = makeVarRe();

/**
 * Extract all template variables from content.
 * Returns array of { name, defaultValue, raw } in order of appearance.
 * Deduplicates by name (first occurrence wins).
 */
function extractVariables(content) {
    if (!content) return [];
    const seen = new Set();
    const vars = [];
    let match;
    // F2: Use a fresh regex per call — no shared lastIndex state
    const re = makeVarRe();
    while ((match = re.exec(content)) !== null) {
        const name = match[1];
        if (seen.has(name)) continue;
        seen.add(name);

        let defaultValue = match[2] !== undefined ? match[2] : null;

        // Resolve $ENV_VAR defaults
        if (defaultValue && defaultValue.startsWith('$')) {
            const envKey = defaultValue.slice(1);
            defaultValue = process.env[envKey] || defaultValue;
        }

        vars.push({ name, defaultValue, raw: match[0] });
    }
    return vars;
}

/**
 * Check if content contains any template variables.
 */
function hasVariables(content) {
    if (!content) return false;
    // F2: Fresh regex per call
    return makeVarRe().test(content);
}

/**
 * Interpolate content with provided values.
 * values: { name: 'value', ... }
 * Missing values fall back to defaultValue, or empty string.
 */
function interpolate(content, values = {}) {
    if (!content) return '';
    // F2: Fresh regex per call
    return content.replace(makeVarRe(), (raw, name, defaultValue) => {
        if (values[name] !== undefined && values[name] !== '') return values[name];
        if (defaultValue !== undefined) {
            // Resolve $ENV_VAR defaults
            if (defaultValue.startsWith('$')) {
                const envKey = defaultValue.slice(1);
                return process.env[envKey] || defaultValue;
            }
            return defaultValue;
        }
        return raw; // leave unresolved
    });
}

/**
 * Prompt for all variables interactively (CLI mode).
 * Returns resolved content string.
 */
function promptAndInterpolate(content) {
    const vars = extractVariables(content);
    if (!vars.length) return content;

    const readline = require('readline-sync');
    const values = {};

    for (const v of vars) {
        const prompt = v.defaultValue !== null
            ? `  ${v.name} [${v.defaultValue}]: `
            : `  ${v.name}: `;

        let answer = readline.question(prompt);

        // X3: Re-prompt once if required variable is empty
        if (!answer && v.defaultValue === null) {
            console.log(`  ("${v.name}" is required — enter a value or press Ctrl+C to abort)`);
            answer = readline.question(prompt);
            if (!answer) {
                console.log('Aborted: required variable not provided.');
                process.exit(1);
            }
        }

        values[v.name] = answer || (v.defaultValue !== null ? v.defaultValue : '');
    }

    return interpolate(content, values);
}

module.exports = {
    VAR_RE,
    extractVariables,
    hasVariables,
    interpolate,
    promptAndInterpolate
};
