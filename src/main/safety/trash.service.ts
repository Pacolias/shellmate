import { cp, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TrashOutcome } from '@shared/types/safety';

const DEFAULT_TRASH_HOME = path.join(os.homedir(), '.local', 'share', 'Trash');

/**
 * The freedesktop.org Trash spec
 * (https://specifications.freedesktop.org/trash-spec/) — home trash only.
 * Files on another filesystem (a different mounted drive) are supposed to
 * get a $topdir/.Trash-$uid directory on THAT filesystem instead; not
 * implemented — a cross-device move falls back to copy+delete into the
 * home trash rather than following the full multi-filesystem spec.
 * Reasonable for what this app targets (a user's home directory),
 * documented as a known limitation.
 *
 * Takes the trash's base directory in the constructor (default: the real
 * `~/.local/share/Trash`) so tests can point it at a throwaway directory
 * instead of touching the developer's actual trash — same reasoning as
 * `HistoryStore` taking an explicit file path.
 */
export class TrashService {
  private readonly filesDir: string;
  private readonly infoDir: string;

  constructor(trashHome: string = DEFAULT_TRASH_HOME) {
    this.filesDir = path.join(trashHome, 'files');
    this.infoDir = path.join(trashHome, 'info');
  }

  async moveToTrash(paths: string[]): Promise<TrashOutcome[]> {
    await this.ensureTrashDirs();
    const outcomes: TrashOutcome[] = [];

    for (const originalPath of paths) {
      try {
        const trashedName = await this.uniqueTrashedName(path.basename(originalPath));
        // Write the .trashinfo *before* moving the file — if the move then
        // fails partway, we're left with an orphaned info file (harmless,
        // ignored by anything reading the trash) rather than a file with
        // no record of where it came from.
        await writeFile(path.join(this.infoDir, `${trashedName}.trashinfo`), formatTrashInfo(originalPath), 'utf8');
        await moveOrCopy(originalPath, path.join(this.filesDir, trashedName));
        outcomes.push({ originalPath, success: true, trashedName });
      } catch (error) {
        outcomes.push({ originalPath, success: false, error: describeError(error) });
      }
    }

    return outcomes;
  }

  async restoreFromTrash(trashedNames: string[]): Promise<TrashOutcome[]> {
    const outcomes: TrashOutcome[] = [];

    for (const trashedName of trashedNames) {
      const infoPath = path.join(this.infoDir, `${trashedName}.trashinfo`);
      try {
        const info = await readFile(infoPath, 'utf8');
        const originalPath = parseTrashInfoPath(info);
        if (!originalPath) throw new Error('No se pudo leer la ubicación original en el registro de la papelera.');

        await mkdir(path.dirname(originalPath), { recursive: true });
        await moveOrCopy(path.join(this.filesDir, trashedName), originalPath);
        await unlink(infoPath);
        outcomes.push({ originalPath, success: true, trashedName });
      } catch (error) {
        outcomes.push({ originalPath: trashedName, success: false, error: describeError(error) });
      }
    }

    return outcomes;
  }

  private async ensureTrashDirs(): Promise<void> {
    await mkdir(this.filesDir, { recursive: true });
    await mkdir(this.infoDir, { recursive: true });
  }

  private async uniqueTrashedName(baseName: string): Promise<string> {
    let candidate = baseName;
    let counter = 1;
    while (await pathExists(path.join(this.filesDir, candidate))) {
      const ext = path.extname(baseName);
      const stem = path.basename(baseName, ext);
      candidate = `${stem}_${counter}${ext}`;
      counter += 1;
    }
    return candidate;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** `rename` is atomic and cheap but fails with EXDEV across filesystems — falls back to a recursive copy-then-delete, which works for both files and directories via `cp`. */
async function moveOrCopy(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await cp(src, dest, { recursive: true });
      await rm(src, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

function formatTrashInfo(originalPath: string): string {
  // The spec wants local time with no fractional seconds, e.g.
  // "2024-01-01T12:00:00" — Date#toISOString is UTC with milliseconds, so
  // it's built by hand instead of just slicing that string.
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const deletionDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `[Trash Info]\nPath=${encodeTrashPath(originalPath)}\nDeletionDate=${deletionDate}\n`;
}

/** Percent-encodes each path segment (not the slashes) per the spec. */
function encodeTrashPath(absolutePath: string): string {
  return absolutePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function parseTrashInfoPath(content: string): string | null {
  const match = /^Path=(.*)$/m.exec(content);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido.';
}
