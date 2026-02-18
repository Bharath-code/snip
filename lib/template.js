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

// Match {{name}} or {{name:default}} — supports colons in default values
const VAR_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}\}/g;

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
    // Reset lastIndex for global regex
    VAR_RE.lastIndex = 0;
    while ((match = VAR_RE.exec(content)) !== null) {
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
    VAR_RE.lastIndex = 0;
    return VAR_RE.test(content);
}

/**
 * Interpolate content with provided values.
 * values: { name: 'value', ... }
 * Missing values fall back to defaultValue, or empty string.
 */
function interpolate(content, values = {}) {
    if (!content) return '';
    return content.replace(VAR_RE, (raw, name, defaultValue) => {
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
        const answer = readline.question(prompt);
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
