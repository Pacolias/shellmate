import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    env: {
      // bash-parser.ts assumes it's running from the electron-vite bundle
      // (out/main/) and looks for grammars/ next to itself there. Under
      // vitest it runs straight from src/, so point it at the real
      // grammars/ directory directly instead.
      SHELLMATE_GRAMMAR_PATH: resolve(__dirname, 'grammars/tree-sitter-bash.wasm'),
    },
  },
});
