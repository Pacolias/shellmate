import type { DangerAssessment, DangerLevel, ParsedCommand, ParsedSegment, ParsedToken } from '@shared/types/command';
import { baseDangerFor } from './command-dictionary';

const LEVEL_RANK: Record<DangerLevel, number> = { safe: 0, caution: 1, destructive: 2 };

const RECURSIVE_LONG_FLAGS = new Set(['--recursive']);
const FORCE_LONG_FLAGS = new Set(['--force']);

/** Paths dangerous enough on their own to escalate an already-modifying command. */
const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /^\/$/, // the filesystem root
  /^~\/?$/, // the whole home directory, unqualified
  /^\*$/, // a bare wildcard, likely to sweep an entire directory
  /^\/(etc|boot|bin|usr|lib|sys|dev)\/?$/, // top-level system directories
  // A handful of specific files, not just directories — worth naming
  // individually because overwriting one via a redirect (`echo x >
  // /etc/passwd`) is a realistic, specific way to break a system that the
  // directory-level patterns above don't catch (they only match `/etc`
  // itself, not a file inside it).
  /^\/etc\/(passwd|shadow|sudoers|hosts|fstab)$/,
];

interface EffectiveInvocation {
  command: string | null;
  args: ParsedToken[];
  viaSudo: boolean;
}

/**
 * Deterministic, rule-based danger classification — never AI. See
 * journal/2026-09-22-danger-classifier-defaults.md for the reasoning behind
 * the specific defaults and escalation rules below.
 */
export function classifyCommand(parsed: ParsedCommand): DangerAssessment {
  if (parsed.segments.length === 0) {
    return { level: 'safe', reason: 'No hay ningún comando que ejecutar.' };
  }

  return parsed.segments
    .map(classifySegment)
    .reduce((worst, current) => (LEVEL_RANK[current.level] > LEVEL_RANK[worst.level] ? current : worst));
}

function classifySegment(segment: ParsedSegment): DangerAssessment {
  if (!segment.command) {
    return { level: 'safe', reason: 'No se ha detectado ningún comando.' };
  }

  const { command, args, viaSudo } = resolveEffectiveInvocation(segment);

  if (!command) {
    return { level: 'caution', reason: 'Ejecuta el siguiente comando como administrador.' };
  }

  const known = baseDangerFor(command);
  let level: DangerLevel = known ?? 'caution';
  let reason = known
    ? undefined
    : `"${command}" no está en nuestro diccionario, así que lo tratamos con precaución.`;

  const flags = args.filter((token) => token.kind === 'flag').map((token) => token.text);
  const positionalArgs = args.filter((token) => token.kind === 'argument').map((token) => token.text);
  const writeRedirectTargets = args
    .filter((token) => token.kind === 'redirect' && isWriteRedirectText(token.text))
    .map((token) => redirectTarget(token.text));

  if (command === 'rm' && hasRecursiveFlag(flags)) {
    level = 'destructive';
    reason = hasForceFlag(flags)
      ? 'Borra carpetas enteras sin pedir confirmación, incluso archivos protegidos.'
      : 'Borra carpetas enteras (y su contenido) sin posibilidad de deshacerlo desde aquí.';
  }

  // A write redirect (`>`, `>>`, ...) modifies the filesystem regardless of
  // what the base command's own danger level says — `echo x > file` is not
  // "safe" just because echo normally is. Read redirects (`<`, `<<<`) are
  // left alone; those don't write anything.
  if (writeRedirectTargets.length > 0) {
    level = maxLevel(level, 'caution');
    reason ??= 'Escribe en un archivo mediante una redirección.';
  }

  // Only escalate for a sensitive target if the command already modifies
  // something — reading a sensitive path (e.g. `ls /etc`) is not dangerous.
  // Redirect targets count here too: `sort < /etc/shadow > /dev/null` reads
  // a sensitive file but writes to a harmless one, and the reverse matters
  // just as much as a sensitive positional argument does.
  if (level !== 'safe') {
    const sensitiveTarget = [...positionalArgs, ...writeRedirectTargets].find(isSensitivePathArgument);
    if (sensitiveTarget) {
      level = 'destructive';
      reason = `Apunta a una ruta sensible del sistema ("${sensitiveTarget}").`;
    }
  }

  if (viaSudo) {
    level = maxLevel(level, 'caution');
    reason ??= 'Se ejecuta con permisos de administrador.';
  }

  return { level, reason: reason ?? defaultReasonFor(level) };
}

/**
 * `sudo rm -rf /` parses as a single command with name "sudo" and
 * everything else as arguments (tree-sitter-bash has no concept of "sudo
 * runs another command"). This recovers the command the shell will actually
 * run, so classification rules apply to it instead of to "sudo" itself.
 */
function resolveEffectiveInvocation(segment: ParsedSegment): EffectiveInvocation {
  if (segment.command !== 'sudo') {
    return { command: segment.command, args: segment.tokens.slice(1), viaSudo: false };
  }

  const rest = segment.tokens.slice(1);
  const commandToken = rest.find((token) => token.kind !== 'flag');
  return {
    command: commandToken?.text ?? null,
    args: rest.filter((token) => token !== commandToken),
    viaSudo: true,
  };
}

function hasRecursiveFlag(flags: string[]): boolean {
  return flags.some((flag) => RECURSIVE_LONG_FLAGS.has(flag) || isShortFlagCluster(flag, 'r'));
}

function hasForceFlag(flags: string[]): boolean {
  return flags.some((flag) => FORCE_LONG_FLAGS.has(flag) || isShortFlagCluster(flag, 'f'));
}

/** True for a single-dash flag (possibly combining several letters, e.g. `-rf`) that includes the given letter, case-insensitively. Long (`--`) options never match here — they're checked against an explicit allowlist instead, so e.g. `--no-preserve-root` isn't mistaken for `--recursive`. */
function isShortFlagCluster(flag: string, letter: string): boolean {
  return flag.startsWith('-') && !flag.startsWith('--') && flag.toLowerCase().includes(letter);
}

function isSensitivePathArgument(text: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(text));
}

/** A redirect token's text is "operator target" (e.g. "> file", "2>> log", "<<< word"). True for any operator that writes (`>`, `>>`, `&>`, `2>`, ...) — false for pure input redirects (`<`, `<<<`), which don't write anything. */
function isWriteRedirectText(text: string): boolean {
  const operator = text.split(/\s+/, 1)[0] ?? '';
  return operator.includes('>');
}

function redirectTarget(text: string): string {
  const spaceIndex = text.indexOf(' ');
  return spaceIndex === -1 ? '' : text.slice(spaceIndex + 1).trim();
}

function maxLevel(a: DangerLevel, b: DangerLevel): DangerLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function defaultReasonFor(level: DangerLevel): string {
  switch (level) {
    case 'safe':
      return 'No modifica archivos ni el sistema.';
    case 'caution':
      return 'Puede modificar archivos o configuración.';
    case 'destructive':
      return 'Puede causar una pérdida de datos difícil de deshacer.';
  }
}
