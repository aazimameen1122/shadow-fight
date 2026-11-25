import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works under a GitHub Pages sub-path
  // (https://<user>.github.io/shadow-fight/) as well as at a domain root.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
});
