import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  server: {
    port: 5173,
    open: true,
    fs: {
      strict: false
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  }
});

