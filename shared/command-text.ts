/**
 * "sudo apt install git" → "apt", "ls -la" → "ls" — the bare command name
 * from raw typed/executed text, unwrapping a leading `sudo`. String-based
 * (not a full parse) since every caller only needs the name: main tracks
 * it for the translated-errors and history-diary flows, the renderer for
 * deciding whether "view as table" applies to the command that just ran.
 */
export function extractCommandName(raw: string): string | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens[0] === 'sudo' && tokens.length > 1) return tokens[1] ?? null;
  return tokens[0] ?? null;
}
