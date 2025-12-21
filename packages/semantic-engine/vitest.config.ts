import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@homunculus/core': path.resolve(__dirname, '../core/src'),
      '@homunculus/semantic-engine': path.resolve(__dirname, './src'),
    },
  },
});
