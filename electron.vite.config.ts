import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      // Non-TS assets the main process reads from disk at runtime (not via
      // `import`), copied next to the bundled main entry so relative paths
      // resolve the same way in dev and in a built/previewed app. See
      // pty-session.ts and bash-parser.ts for how they locate these.
      viteStaticCopy({
        targets: [
          { src: 'src/main/pty/shell-init/**/*', dest: 'shell-init' },
          { src: 'grammars/tree-sitter-bash.wasm', dest: 'grammars' },
        ],
      }),
    ],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
  },
});
