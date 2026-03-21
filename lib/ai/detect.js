/**
 * Language Detection Module
 *
 * Heuristics for detecting programming languages
 */

/**
 * Detect programming language from content and prompt
 *
 * @param {string} content - Generated code content
 * @param {string} prompt - Original user prompt
 * @returns {string} - Detected language
 */
function detectLanguage(content, prompt) {
  // Priority 1: Check for shebang lines
  const firstLine = content.split('\n')[0] || '';
  const shebangMatch = firstLine.match(/^#!\s*(?:\/usr\/bin\/env\s+)?([^\s]+)/);
  if (shebangMatch) {
    const interpreter = shebangMatch[1];
    const shebangMap = {
      'bash': 'bash',
      'sh': 'sh',
      'zsh': 'zsh',
      'fish': 'fish',
      'python': 'python',
      'python3': 'python',
      'node': 'js',
      'perl': 'perl',
      'ruby': 'ruby',
      'php': 'php',
    };
    if (shebangMap[interpreter]) {
      return shebangMap[interpreter];
    }
  }

  // Priority 2: Look for language-specific syntax patterns
  const patterns = [
    // Python
    { regex: /^(def |import |from |class |if __name__|print\()/m, lang: 'python' },
    // JavaScript/Node
    { regex: /^(const |let |var |function |require\(|import |console\.|exports\.|module\.exports)/m, lang: 'js' },
    // TypeScript
    { regex: /^(interface |type |as |import.*from.*\.ts|export.*:)/m, lang: 'ts' },
    // Bash/Shell
    { regex: /^(#!|if\s+\[|echo\s|export\s|function\s+\w+\s*\(\))/m, lang: 'bash' },
    // SQL
    { regex: /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/i, lang: 'sql' },
    // Dockerfile
    { regex: /^(FROM|RUN|CMD|COPY|ADD|ENTRYPOINT|WORKDIR)/i, lang: 'dockerfile' },
    // YAML
    { regex: /^[\s]*[-#]\s*[a-z_]+:/m, lang: 'yaml' },
    // JSON
    { regex: /^\s*\{[\s\S*]\}\s*$/, lang: 'json' },
    // Go
    { regex: /^(package |func |import \")/m, lang: 'go' },
    // Rust
    { regex: /^(use |fn |impl |pub |mod |extern)/m, lang: 'rust' },
    // Java
    { regex: /^(public |import java|class |package |@Override)/m, lang: 'java' },
    // C#
    { regex: /^(using |namespace |public |class |async |var \w+ =)/m, lang: 'csharp' },
    // PHP
    { regex: /^<\?php|\$[a-zA-Z_]\w*\s*=|function\s+\w+\s*\(/m, lang: 'php' },
    // Ruby
    { regex: /^(require |class |def |module |include |@)/m, lang: 'ruby' },
    // Perl
    { regex: /^(use |my |sub |print |\$[A-Z_])/m, lang: 'perl' },
    // PowerShell
    { regex: /^(param\(|function |Write-|Get-|Set-|New-)/m, lang: 'powershell' },
  ];

  for (const { regex, lang } of patterns) {
    if (regex.test(content)) {
      return lang;
    }
  }

  // Priority 3: Analyze prompt for language keywords
  const promptLower = prompt.toLowerCase();
  const promptMap = {
    'python': 'python',
    'javascript': 'js',
    'typescript': 'ts',
    'node': 'js',
    'nodejs': 'js',
    'bash': 'bash',
    'shell': 'bash',
    'sh': 'bash',
    'zsh': 'zsh',
    'fish': 'fish',
    'sql': 'sql',
    'docker': 'dockerfile',
    'dockerfile': 'dockerfile',
    'yaml': 'yaml',
    'yml': 'yaml',
    'json': 'json',
    'go': 'go',
    'golang': 'go',
    'rust': 'rust',
    'java': 'java',
    'c#': 'csharp',
    'csharp': 'csharp',
    'php': 'php',
    'ruby': 'ruby',
    'perl': 'perl',
    'powershell': 'powershell',
    'ps1': 'powershell',
  };

  for (const [keyword, lang] of Object.entries(promptMap)) {
    if (promptLower.includes(keyword)) {
      return lang;
    }
  }

  // Priority 4: File extension mentions in prompt
  const extMatch = prompt.match(/\.(js|ts|py|sh|bash|zsh|fish|sql|yml|yaml|json|go|rs|java|cs|php|rb|pl|ps1)\b/i);
  if (extMatch) {
    const extMap = {
      'js': 'js',
      'ts': 'ts',
      'py': 'python',
      'sh': 'sh',
      'bash': 'bash',
      'zsh': 'zsh',
      'fish': 'fish',
      'sql': 'sql',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'pl': 'perl',
      'ps1': 'powershell',
    };
    return extMap[extMatch[1].toLowerCase()] || 'text';
  }

  // Default to 'text' if no language detected
  return 'text';
}

module.exports = detectLanguage;