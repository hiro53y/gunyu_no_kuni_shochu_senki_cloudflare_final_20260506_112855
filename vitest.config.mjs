import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 600000,
    // CPU-bound campaign solvers can starve worker RPC when files compete.
    fileParallelism: false,
  },
});
