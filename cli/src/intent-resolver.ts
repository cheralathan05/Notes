/**
 * Centralized Command-Intent Resolver for Project Atlas
 * 
 * Accurately parses user input across interactive terminal, CLI, and extensions.
 * Normalizes case, whitespace, and punctuation, mapping developer intent
 * to canonical task-completion workflows.
 */

export type IntentType =
  | 'COMPLETE'
  | 'SUBMIT'
  | 'SUBMIT_FOR_REVIEW'
  | 'VERIFY'
  | 'CHECK_STATUS'
  | 'HELP'
  | 'NUMBERED_ACTION'
  | 'NAV_BACK'
  | 'NAV_EXIT'
  | 'UNKNOWN';

export interface ResolvedIntent {
  type: IntentType;
  rawInput: string;
  normalizedInput: string;
  actionNumber?: number;
  targetTaskId?: string;
  feedbackMessage: string;
}

// Canonical aliases for completion workflows
const COMPLETE_ALIASES = new Set([
  'complete',
  'completed',
  'done',
  'finish',
  'finished',
  'mark complete',
  'mark as complete',
  'complete task',
  'finish task',
  'mark done',
  'mark as done',
  'c',
]);

const SUBMIT_ALIASES = new Set([
  'submit',
  'submit task',
  'submit evidence',
  's',
]);

const SUBMIT_FOR_REVIEW_ALIASES = new Set([
  'submit for review',
  'submit review',
  'request review',
  'ask for review',
  'review',
  'r',
]);

const VERIFY_ALIASES = new Set([
  'verify',
  'verification',
  'verify task',
  'run checks',
  'checks',
  'test',
  'run tests',
  'v',
]);

const STATUS_ALIASES = new Set([
  'check status',
  'status',
  'task status',
  'refresh',
  'refresh status',
  'refresh task',
]);

const HELP_ALIASES = new Set([
  'help',
  '?',
  'shortcuts',
  'commands',
  'actions',
  'menu',
  'h',
]);

const BACK_ALIASES = new Set(['b', 'back', 'return', 'prev', 'previous']);
const EXIT_ALIASES = new Set(['q', 'quit', 'exit', 'close']);

/**
 * Normalizes input: trims, collapses whitespace, strips boundary punctuation, and lowercases.
 */
export function normalizeInput(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed === '?') return '?';
  return trimmed
    .replace(/^["'`]|["'`]$/g, '') // remove surrounding quotes
    .replace(/[.!?:;]+$/, '') // strip trailing sentence punctuation
    .replace(/\s+/g, ' ') // collapse internal whitespace
    .toLowerCase();
}

/**
 * Extracts a potential canonical task identifier from an input string (e.g. "complete TASK-102" -> "TASK-102")
 */
function extractTaskId(normalized: string): { commandPart: string; taskId?: string } {
  // Matches task ID formats like "TASK-1234", "task-cmv85658", "TASK-cmv85658", or standalone cuid
  const match = normalized.match(/^(.*?)\s+(task-[a-z0-9_-]+|[a-z0-9]{20,32})$/i);
  if (match) {
    return {
      commandPart: match[1].trim(),
      taskId: match[2].toUpperCase().startsWith('TASK-') ? match[2].toUpperCase() : `TASK-${match[2]}`,
    };
  }
  return { commandPart: normalized };
}

/**
 * Resolves user input into a strongly-typed command intent with contextual feedback.
 */
export function resolveCommandIntent(rawInput: string): ResolvedIntent {
  const normalized = normalizeInput(rawInput);
  const { commandPart, taskId } = extractTaskId(normalized);

  // 1. Numbered Actions (e.g. "1", "12")
  if (/^\d+$/.test(commandPart)) {
    const actionNumber = parseInt(commandPart, 10);
    return {
      type: 'NUMBERED_ACTION',
      rawInput,
      normalizedInput: normalized,
      actionNumber,
      targetTaskId: taskId,
      feedbackMessage: `Executing numbered action [${actionNumber}]...`,
    };
  }

  // 2. Navigation Actions
  if (BACK_ALIASES.has(commandPart)) {
    return {
      type: 'NAV_BACK',
      rawInput,
      normalizedInput: normalized,
      feedbackMessage: 'Returning to previous view...',
    };
  }

  if (EXIT_ALIASES.has(commandPart)) {
    return {
      type: 'NAV_EXIT',
      rawInput,
      normalizedInput: normalized,
      feedbackMessage: 'Exiting Project Atlas...',
    };
  }

  // 3. Completion Intent
  if (COMPLETE_ALIASES.has(commandPart)) {
    return {
      type: 'COMPLETE',
      rawInput,
      normalizedInput: normalized,
      targetTaskId: taskId,
      feedbackMessage: 'Completion requested. Opening the task completion workflow...',
    };
  }

  // 4. Submit for Review Intent
  if (SUBMIT_FOR_REVIEW_ALIASES.has(commandPart)) {
    return {
      type: 'SUBMIT_FOR_REVIEW',
      rawInput,
      normalizedInput: normalized,
      targetTaskId: taskId,
      feedbackMessage: 'Review submission requested. Opening review workflow...',
    };
  }

  // 5. Submit Intent
  if (SUBMIT_ALIASES.has(commandPart)) {
    return {
      type: 'SUBMIT',
      rawInput,
      normalizedInput: normalized,
      targetTaskId: taskId,
      feedbackMessage: 'Submission requested. Opening evidence submission workflow...',
    };
  }

  // 6. Verification Intent
  if (VERIFY_ALIASES.has(commandPart)) {
    return {
      type: 'VERIFY',
      rawInput,
      normalizedInput: normalized,
      targetTaskId: taskId,
      feedbackMessage: 'Verification requested. Opening verification screen...',
    };
  }

  // 7. Check Status Intent
  if (STATUS_ALIASES.has(commandPart)) {
    return {
      type: 'CHECK_STATUS',
      rawInput,
      normalizedInput: normalized,
      targetTaskId: taskId,
      feedbackMessage: 'Refreshing actual task status from platform...',
    };
  }

  // 8. Help Intent
  if (HELP_ALIASES.has(commandPart)) {
    return {
      type: 'HELP',
      rawInput,
      normalizedInput: normalized,
      feedbackMessage: 'Showing available actions and shortcuts...',
    };
  }

  // 9. Unknown Intent
  return {
    type: 'UNKNOWN',
    rawInput,
    normalizedInput: normalized,
    feedbackMessage: 'Unknown command. Type `help` to see available commands.',
  };
}
