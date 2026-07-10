import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Sandbox/' : '/',
  resolve: {
    alias: {
      viberanium: path.resolve(__dirname, '../viberanium/src'),
      sandbox: path.resolve(__dirname, '../sandbox/src/SandboxApp.tsx'),
      construct: path.resolve(__dirname, '../construct/src/ConstructApp.tsx'),
    },
  },
  optimizeDeps: {
    exclude: ['viberanium', 'sandbox', 'construct'],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    watch: {
      ignored: ['**/*.pdnSave', '**/*~'],
    },
  },
});

