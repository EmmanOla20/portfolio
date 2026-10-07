const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'public', 'data', 'test-data']
  }
});