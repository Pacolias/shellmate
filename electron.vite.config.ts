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
        // electron-vite builds main/preload as Vite's "ssr" environment
        // (not the "client" environment this plugin defaults to) —
        // without this it silently no-ops, see journal entry.
        environment: 'ssr',
        targets: [
          // stripBase counts path segments *relative to the project root*
          // to cut from the front of each matched file's path (see journal
          // entry — the plugin's default behavior mirrors the full
          // root-relative path under `dest`, which is never what we want
          // here). 4 = "src/main/pty/shell-init", so a file directly in
          // that folder lands at out/main/shell-init/<file>, and
          // zsh-zdotdir/.zshrc still keeps that one subdirectory level.
          { src: 'src/main/pty/shell-init/**/*', dest: 'shell-init', rename: { stripBase: 4 } },
          // 1 = "grammars", so the file lands flat at out/main/grammars/<file>.
          { src: 'grammars/tree-sitter-bash.wasm', dest: 'grammars', rename: { stripBase: 1 } },
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
