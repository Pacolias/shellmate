import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser, type Node as TsNode } from 'web-tree-sitter';
import type { ParsedCommand, ParsedSegment, ParsedToken } from '@shared/types/command';

// electron-vite bundles the main process into a single out/main/index.js, so
// this always resolves relative to that directory, not to this source
// file's location — grammars/ is copied there at build time (see
// electron.vite.config.ts's viteStaticCopy targets). Vitest, however, runs
// this file straight from src/, where that bundled-output assumption is
// wrong — vitest.config.ts points SHELLMATE_GRAMMAR_PATH at the real
// grammars/ directory instead for that context.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const GRAMMAR_PATH = process.env.SHELLMATE_GRAMMAR_PATH ?? path.join(moduleDir, 'grammars', 'tree-sitter-bash.wasm');

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

  // Redirects (`> file`, `>> file`, `<<< word`) are their own field, not
  // arguments — but danger-classifier.ts needs to see them (writing to a
  // sensitive path via `>` is exactly the kind of thing it has to catch),
  // and pipeline preview needs them to reconstruct a stage's real command
  // line. Kept as one token per redirect (operator + target together)
  // rather than split further — nothing downstream needs them apart.
  for (const redirectNode of collectRedirectNodes(node)) {
    tokens.push({
      kind: 'redirect',
      text: redirectNode.text,
      start: redirectNode.startIndex,
      end: redirectNode.endIndex,
    });
  }

  return { command: nameNode?.text ?? null, tokens };
}

/**
 * A `command` node's own `redirect` field only fires in some syntactic
 * shapes. The common case — a redirect trailing a plain command, e.g.
 * `echo hi > file` — instead wraps the command in a `redirected_statement`
 * node, with the redirect(s) as *its* children, sibling to the command
 * rather than inside it. Confirmed by dumping the actual parse tree rather
 * than assuming from the grammar's field list.
 */
function collectRedirectNodes(commandNode: TsNode): TsNode[] {
  const direct = commandNode.childrenForFieldName('redirect');
  const parent = commandNode.parent;
  const fromWrapper = parent?.type === 'redirected_statement' ? parent.childrenForFieldName('redirect') : [];
  return [...direct, ...fromWrapper];
}
