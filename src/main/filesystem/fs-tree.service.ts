import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { DirectoryEntry, ListDirectoryResult } from '@shared/types/filesystem';

/**
 * Lists one directory's immediate children for the filesystem map, which
 * loads the tree lazily (one `listDirectory` call per expanded folder)
 * rather than walking the whole tree up front.
 */
export async function listDirectory(targetPath: string): Promise<ListDirectoryResult> {
  try {
    const dirents = await readdir(targetPath, { withFileTypes: true });
    const entries: DirectoryEntry[] = dirents
      .filter((entry) => !isHidden(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: path.join(targetPath, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort(compareEntries);

    return { path: targetPath, entries, error: null };
  } catch (error) {
    return { path: targetPath, entries: [], error: describeError(error) };
  }
}

/** Dotfiles are hidden by default — a beginner-focused map, not a full file manager. */
function isHidden(name: string): boolean {
  return name.startsWith('.');
}

function compareEntries(a: DirectoryEntry, b: DirectoryEntry): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function describeError(error: unknown): string {
  const code = errnoCode(error);
  if (code === 'EACCES' || code === 'EPERM') return 'No tienes permiso para ver esta carpeta.';
  if (code === 'ENOENT') return 'Esta carpeta ya no existe.';
  if (code === 'ENOTDIR') return 'Esto no es una carpeta.';
  return 'No se ha podido leer esta carpeta.';
}

function errnoCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as NodeJS.ErrnoException).code;
  }
  return undefined;
}
