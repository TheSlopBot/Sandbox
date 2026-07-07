import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Sandbox/' : '/',
  server: {
    watch: {
      // Paint.NET leaves locked temp files like favicon.png.0.pdnSave while editing.
      ignored: ['**/*.pdnSave', '**/*~'],
    },
  },
});

