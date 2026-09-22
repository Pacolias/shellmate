import type { ITheme } from '@xterm/xterm';

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Reads the current design tokens (theme/tokens.css) into an xterm.js theme, since xterm renders on canvas and can't consume CSS variables directly. */
export function resolveXtermTheme(): ITheme {
  return {
    background: readCssVar('--color-bg-terminal'),
    foreground: readCssVar('--color-text-on-terminal'),
    cursor: readCssVar('--color-accent'),
    selectionBackground: readCssVar('--color-accent'),
  };
}
