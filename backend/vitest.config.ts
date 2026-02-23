import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run tests sequentially - they share a database
    fileParallelism: false,
    // Test file patterns
    include: ['test/**/*.test.ts'],
    // Global setup/teardown
    setupFiles: ['./test/setup.ts'],
    // Generous timeout for DB operations
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-vitest',
      DATABASE_URL: 'postgresql://postgres:dev123@localhost:5432/pathology_study_test',
    },
  },
});
