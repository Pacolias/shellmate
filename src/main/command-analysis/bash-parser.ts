import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser, type Node as TsNode } from 'web-tree-sitter';
import type { ParsedCommand, ParsedSegment, ParsedToken } from '@shared/types/command';

// electron-vite bundles the main process into a single out/main/index.js, so
// this always resolves relative to that directory, not to this source
// file's location — grammars/ is copied there at build time (see
// electron.vite.config.ts's viteStaticCopy targets).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const GRAMMAR_PATH = path.join(moduleDir, 'grammars', 'tree-sitter-bash.wasm');

let parserPromise: Promise<Parser> | undefined;

async function loadParser(): Promise<Parser> {
  parserPromise ??= (async () => {
    await Parser.init();
    const language = await Language.load(GRAMMAR_PATH);
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
  })();
  return parserPromise;
}

/**
 * Parses a line of shell input into a simplified AST: one segment per
 * command invocation (regardless of how they're chained — pipes, `&&`,
 * `;`), each with its command name and argument tokens. Used by both the
 * danger classifier and the subtitles module, so they never disagree about
 * how a command was broken down.
 */
export async function parseCommand(raw: string): Promise<ParsedCommand> {
  if (raw.trim().length === 0) {
    return { raw, segments: [], hasSyntaxError: false };
  }

  const parser = await loadParser();
  const tree = parser.parse(raw);
  if (!tree) {
    return { raw, segments: [], hasSyntaxError: true };
  }

  try {
    const commandNodes = tree.rootNode.descendantsOfType('command');
    const segments = commandNodes.map(toSegment);
    return { raw, segments, hasSyntaxError: tree.rootNode.hasError };
  } finally {
    tree.delete();
  }
}

function toSegment(node: TsNode): ParsedSegment {
  const nameNode = node.childForFieldName('name');
  const tokens: ParsedToken[] = [];

  if (nameNode) {
    tokens.push({ kind: 'command', text: nameNode.text, start: nameNode.startIndex, end: nameNode.endIndex });
  }

  for (const argNode of node.childrenForFieldName('argument')) {
    tokens.push({
      kind: argNode.text.startsWith('-') ? 'flag' : 'argument',
      text: argNode.text,
      start: argNode.startIndex,
      end: argNode.endIndex,
    });
  }

  return { command: nameNode?.text ?? null, tokens };
}
