/** What a single rm/mv argument (a literal path or a glob pattern) actually resolves to on disk, without running anything. */
export interface PreviewTarget {
  pattern: string;
  matches: string[];
  /** True when `pattern` has no glob characters and simply doesn't exist — the real command would fail on it. */
  missing: boolean;
}

export interface DestructivePreview {
  action: 'delete' | 'move';
  /** Only set for `mv` — the resolved destination. */
  destination: string | null;
  targets: PreviewTarget[];
}

export interface TrashOutcome {
  originalPath: string;
  success: boolean;
  /** Identifies this file in ~/.local/share/Trash for a later restore — absent when `success` is false. */
  trashedName?: string;
  error?: string;
}
