// v0.2b:
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['node_modules', 'dist', 'Backup7', 'tests/performance'],
  },
});
