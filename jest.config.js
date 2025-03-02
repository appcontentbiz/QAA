module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: [
    '**/test/**/*.test.js'
  ],
  moduleFileExtensions: ['js', 'json'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  globals: {
    'NODE_ENV': 'test'
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
