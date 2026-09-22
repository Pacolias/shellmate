export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

type TableParser = (raw: string) => ParsedTable | null;

/**
 * Command-specific parsers for turning known commands' real output into a
 * table — "ver como tabla" (PLAN.md §4.8). Every parser bails (returns
 * null) rather than guess when the actual output doesn't match the shape
 * it expects, so an unusual locale, a different flag, or a genuinely
 * unrecognized command never invents a fake structure.
 */
const PARSERS: Record<string, TableParser> = {
  ps: parseColumnsWithHeader,
  free: parseColumnsWithHeader,
  df: parseColumnsWithHeader,
  du: parseSizeAndPath,
  ls: parseLsLongFormat,
};

export function parseTabularOutput(command: string | null, raw: string): ParsedTable | null {
  if (!command) return null;
  return PARSERS[command]?.(raw) ?? null;
}

function splitLines(raw: string): string[] {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

/** `ps`, `free`, `df -h`: a header row followed by whitespace-separated columns. The last column absorbs any overflow (e.g. `ps`'s CMD, which can contain spaces). */
function parseColumnsWithHeader(raw: string): ParsedTable | null {
  const lines = splitLines(raw);
  if (lines.length < 2) return null;

  const headers = normalizeHeaders(lines[0]?.trim().split(/\s+/) ?? []);
  if (headers.length < 2) return null;

  const rows: string[][] = [];
  for (const line of lines.slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < headers.length) return null;
    const head = parts.slice(0, headers.length - 1);
    const tail = parts.slice(headers.length - 1).join(' ');
    rows.push([...head, tail]);
  }
  return { headers, rows };
}

/** `df`'s own header is "... Use% Mounted on" — the only multi-word header among the commands this module knows, so a plain whitespace split would otherwise count it as two columns and mismatch every data row. */
function normalizeHeaders(headers: string[]): string[] {
  const mountedIndex = headers.indexOf('Mounted');
  if (mountedIndex !== -1 && headers[mountedIndex + 1] === 'on') {
    return [...headers.slice(0, mountedIndex), 'Mounted on', ...headers.slice(mountedIndex + 2)];
  }
  return headers;
}

/** `du`: "<size>\s+<path>" per line, no header. */
function parseSizeAndPath(raw: string): ParsedTable | null {
  const lines = splitLines(raw);
  if (lines.length === 0) return null;

  const rows: string[][] = [];
  for (const line of lines) {
    const match = /^(\S+)\s+(.+)$/.exec(line);
    if (!match) return null;
    rows.push([match[1] ?? '', match[2] ?? '']);
  }
  return { headers: ['Tamaño', 'Ruta'], rows };
}

/** `ls -l`: permissions, link count, owner, group, size, 3-part date, then a name that may itself contain spaces. Only matches this specific shape — plain `ls` output is correctly left unparsed. */
function parseLsLongFormat(raw: string): ParsedTable | null {
  const allLines = splitLines(raw);
  const lines = allLines[0]?.startsWith('total ') ? allLines.slice(1) : allLines;
  if (lines.length === 0) return null;

  const rows: string[][] = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) return null;
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
  return { headers: ['Permisos', 'Enlaces', 'Dueño', 'Grupo', 'Tamaño', 'Fecha', 'Nombre'], rows };
}
