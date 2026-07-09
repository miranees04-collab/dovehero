import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// Builds ONLY the reporting dashboard as one self-contained HTML file
// (all JS/CSS inlined) so it can be shared or published as an artifact.
//   npx vite build --config vite.dashboard.config.ts
// Output: dist-dashboard/dashboard.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-dashboard',
    rollupOptions: {
      input: fileURLToPath(new URL('./dashboard.html', import.meta.url)),
    },
  },
});
