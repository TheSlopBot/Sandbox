import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Sandbox/' : '/',
  resolve: {
    alias: {
      viberanium: path.resolve(__dirname, '../viberanium/src'),
    },
  },
  server: {
    watch: {
      ignored: ['**/*.pdnSave', '**/*~'],
    },
  },
});
