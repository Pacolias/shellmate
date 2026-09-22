export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

type TableParser = (raw: string) => ParsedTable | null;

/**
 * Command-specific parsers for turning known commands' real output into a
 * table — "ver como tabla" (PLAN.md §4.8). Every parser skips (or, if
 * nothing at all matches, bails on) lines that don't match the shape it
 * expects, rather than guessing — real captured output isn't clean: color
 * codes from a `ls --color` alias, and (more surprisingly) output from
 * *other* shell-integration hooks sharing the same precmd/preexec cycle
 * (a themed prompt, VTE's own OSC 666) can end up folded into what we
 * capture between our own OSC 133;C and 133;D markers. See
 * journal/2026-09-22-table-view-real-output-noise.md — found by actually
 * running `ls -l` for real, not from a clean synthetic test string.
 */
const PARSERS: Record<string, TableParser> = {
  ps: parseColumnsWithHeader,
  df: parseColumnsWithHeader,
  du: parseSizeAndPath,
  ls: parseLsLongFormat,
  // `free` deliberately left out: its rows are prefixed with a label
  // ("Mem:", "Swap:") that isn't one of the header's columns, the
  // opposite shape from ps/df's trailing-overflow columns — the model
  // below can't represent it without guessing, so it's not offered
  // rather than shown wrong.
};

export function parseTabularOutput(command: string | null, raw: string): ParsedTable | null {
  if (!command) return null;
  return PARSERS[command]?.(stripAnsi(raw)) ?? null;
}

// Matches both CSI sequences (color codes, cursor movement, "\x1b[K") and
// OSC sequences (terminated by BEL or ST) — everything a shell's own
// prompt/theme might emit that isn't the command's actual text output.
const ANSI_PATTERN = /\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function splitLines(raw: string): string[] {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// A header word may start with '%' (ps aux's "%CPU"/"%MEM") as well as a letter.
const HEADER_LINE_PATTERN = /^[A-Za-z%][A-Za-z0-9_%]*(\s+[A-Za-z%][A-Za-z0-9_%]*)+$/;

/** `ps`, `df -h`: a header row followed by whitespace-separated columns. The last column absorbs any overflow (e.g. `ps`'s CMD, which can contain spaces). Lines that don't split into at least as many fields as the header are skipped rather than failing the whole table — stray prompt/theme output sharing the same captured blob shouldn't hide real data. */
function parseColumnsWithHeader(raw: string): ParsedTable | null {
  const lines = splitLines(raw);
  const headerIndex = lines.findIndex((line) => HEADER_LINE_PATTERN.test(line));
  if (headerIndex === -1) return null;

  const headers = normalizeHeaders(lines[headerIndex]?.split(/\s+/) ?? []);
  if (headers.length < 2) return null;

  const rows: string[][] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const parts = line.split(/\s+/);
    if (parts.length < headers.length) continue;
    const head = parts.slice(0, headers.length - 1);
    const tail = parts.slice(headers.length - 1).join(' ');
    rows.push([...head, tail]);
  }
  return rows.length > 0 ? { headers, rows } : null;
}

/** `df`'s own header is "... Use% Mounted on" — the only multi-word header among the commands this module knows, so a plain whitespace split would otherwise count it as two columns and mismatch every data row. */
function normalizeHeaders(headers: string[]): string[] {
  const mountedIndex = headers.indexOf('Mounted');
  if (mountedIndex !== -1 && headers[mountedIndex + 1] === 'on') {
    return [...headers.slice(0, mountedIndex), 'Mounted on', ...headers.slice(mountedIndex + 2)];
  }
  return headers;
}

/** `du`: "<size>\s+<path>" per line, no header. Lines that don't match (stray theme/prompt output) are skipped. */
function parseSizeAndPath(raw: string): ParsedTable | null {
  const lines = splitLines(raw);
  const rows: string[][] = [];
  for (const line of lines) {
    const match = /^(\S+)\s+(.+)$/.exec(line);
    if (match) rows.push([match[1] ?? '', match[2] ?? '']);
  }
  return rows.length > 0 ? { headers: ['Tamaño', 'Ruta'], rows } : null;
}

// A unix permission string: file-type char, then rwx x3 (each possibly a
// special bit), optionally followed by "." (SELinux context) or "+" (ACL).
const LS_PERMISSIONS_PATTERN = /^[dlcbps-][rwxstST-]{9}[.+]?$/;

/** `ls -l`: permissions, link count, owner, group, size, 3-part date, then a name that may itself contain spaces. Only lines starting with a real permission string are treated as data — "total N" and anything else present in the captured output (plain `ls`'s non-`-l` output included) is skipped, not guessed at. */
function parseLsLongFormat(raw: string): ParsedTable | null {
  const rows: string[][] = [];
  for (const line of splitLines(raw)) {
    const parts = line.split(/\s+/);
    if (parts.length < 9 || !LS_PERMISSIONS_PATTERN.test(parts[0] ?? '')) continue;
    const [permissions, links, owner, group, size, month, day, time, ...nameParts] = parts;
    rows.push([
      permissions ?? '',
      links ?? '',
      owner ?? '',
      group ?? '',
      size ?? '',
      `${month} ${day} ${time}`,
      nameParts.join(' '),
    ]);
  }
  return rows.length > 0
    ? { headers: ['Permisos', 'Enlaces', 'Dueño', 'Grupo', 'Tamaño', 'Fecha', 'Nombre'], rows }
    : null;
}
