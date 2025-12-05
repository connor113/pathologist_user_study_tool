import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    // CRITICAL: Increase concurrent connections for faster tile loading
    // Default is around 100, but we need more for tiles
    fs: {
      strict: false // Allow serving files from tiles directory
    },
    // Disable HTTP/2 push for better compatibility
    middlewareMode: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

