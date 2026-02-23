import { defineConfig } from 'vite';
import express from 'express';
import path from 'path';

/**
 * Custom plugin: serve /tiles as raw static files with aggressive caching.
 * Bypasses Vite's transform pipeline entirely — critical for performance
 * when OpenSeadragon requests hundreds of small JPEG tiles per zoom.
 */
function tilesPlugin() {
  return {
    name: 'serve-tiles',
    configureServer(server: any) {
      // Register BEFORE Vite's own middleware so /tiles requests
      // never hit the transform pipeline
      server.middlewares.use(
        '/tiles',
        express.static(path.resolve(__dirname, 'tiles'), {
          maxAge: '1h',           // Browser caches tiles for 1 hour
          immutable: false,
          etag: true,
          lastModified: true,
          index: false,           // No directory listings
          fallthrough: false,     // 404 immediately if tile missing (no Vite fallback)
        })
      );
    },
  };
}

export default defineConfig({
  plugins: [tilesPlugin()],
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

