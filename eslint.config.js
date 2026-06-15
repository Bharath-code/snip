module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        Uint8Array: 'readonly'
      }
    },
    plugins: {
      local: {
        rules: {
          'no-process-exit': {
            meta: {
              type: 'suggestion',
              docs: { description: 'Enforce process.exitCode instead of process.exit()' },
              schema: []
            },
            create(context) {
              return {
                CallExpression(node) {
                  if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.object.type === 'Identifier' &&
                    node.callee.object.name === 'process' &&
                    node.callee.property.type === 'Identifier' &&
                    node.callee.property.name === 'exit'
                  ) {
                    // Allow signal handler exits (130 = SIGINT, 143 = SIGTERM)
                    if (
                      node.arguments.length === 1 &&
                      node.arguments[0].type === 'Literal' &&
                      (node.arguments[0].value === 130 || node.arguments[0].value === 143)
                    ) {
                      return;
                    }

                    context.report({
                      node,
                      message: 'Use process.exitCode = <code>; return; instead of process.exit(<code>). This allows cleanup hooks (process.on("exit", ...), beforeExit) to run. Use /* eslint-disable-next-line local/no-process-exit */ for intentional uses (Commander event handlers, TUI quit).',
                    });
                  }
                }
              };
            }
          }
        }
      }
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'no-shadow': 'warn',
      'local/no-process-exit': 'error'
    }
  }
];
