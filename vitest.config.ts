// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: ['e2e/**', 'tests/e2e/**'], // prevent Vitest from running Playwright tests
  },
  esbuild: {
    jsx: 'automatic',                        // just in case
    jsxInject: `import React from 'react';`, // inject React for all TSX files
  },
});
