/**
 * How much scaffolding the app shows. Every module reads this value and
 * decides its own behavior — nothing else depends on it directly.
 */
export type HelpLevel = 'high' | 'medium' | 'low';

export const HELP_LEVELS: readonly HelpLevel[] = ['high', 'medium', 'low'];

export const DEFAULT_HELP_LEVEL: HelpLevel = 'high';
