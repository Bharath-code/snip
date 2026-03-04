module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  watchman: false,
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/commands/ui.js',       // TUI — requires blessed, not unit-testable
    '!lib/migrate_to_sqlite.js', // migration script
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json'],
  coverageThresholds: {
    global: {
      branches: 30,
      functions: 35,
      lines: 40,
      statements: 40,
    },
  },
};
