import { resolveCommandIntent, normalizeInput } from '../src/intent-resolver';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Command-Intent Resolver Test Suite...\n');

// 1. Completion Aliases
const completionVariants = [
  'complete',
  'completed',
  'done',
  'finish',
  'finished',
  'mark complete',
  'mark as complete',
  'complete task',
  'finish task',
  '  COMPLETE  ',
  'Done.',
  'Mark As Complete!',
  'finish TASK-cmv85658',
  'complete task-102',
];

for (const variant of completionVariants) {
  const res = resolveCommandIntent(variant);
  assert(
    res.type === 'COMPLETE',
    `Expected "${variant}" to resolve to COMPLETE, got ${res.type}`
  );
  assert(
    res.feedbackMessage.includes('Completion requested'),
    `Expected feedback message for "${variant}"`
  );
  console.log(`✔ [PASS] Resolved "${variant}" -> COMPLETE (feedback: "${res.feedbackMessage}")`);
}

// 2. Submit Aliases
const submitVariants = ['submit', 'submit task', 'SUBMIT', '  submit  '];
for (const variant of submitVariants) {
  const res = resolveCommandIntent(variant);
  assert(res.type === 'SUBMIT', `Expected "${variant}" to resolve to SUBMIT`);
  console.log(`✔ [PASS] Resolved "${variant}" -> SUBMIT`);
}

// 3. Submit for Review
const reviewVariants = ['submit for review', 'Submit For Review', 'request review'];
for (const variant of reviewVariants) {
  const res = resolveCommandIntent(variant);
  assert(res.type === 'SUBMIT_FOR_REVIEW', `Expected "${variant}" to resolve to SUBMIT_FOR_REVIEW`);
  console.log(`✔ [PASS] Resolved "${variant}" -> SUBMIT_FOR_REVIEW`);
}

// 4. Verify & Status
assert(resolveCommandIntent('verify').type === 'VERIFY', 'verify should resolve to VERIFY');
assert(resolveCommandIntent('run checks').type === 'VERIFY', 'run checks should resolve to VERIFY');
assert(resolveCommandIntent('check status').type === 'CHECK_STATUS', 'check status should resolve to CHECK_STATUS');
assert(resolveCommandIntent('status').type === 'CHECK_STATUS', 'status should resolve to CHECK_STATUS');
console.log('✔ [PASS] Verification and Status intents resolved successfully');

// 5. Help Intent
assert(resolveCommandIntent('help').type === 'HELP', 'help should resolve to HELP');
assert(resolveCommandIntent('?').type === 'HELP', '? should resolve to HELP');
console.log('✔ [PASS] Help intent resolved successfully');

// 6. Numbered Actions
const numRes1 = resolveCommandIntent('1');
assert(numRes1.type === 'NUMBERED_ACTION' && numRes1.actionNumber === 1, '1 should resolve to NUMBERED_ACTION 1');
const numRes15 = resolveCommandIntent('15');
assert(numRes15.type === 'NUMBERED_ACTION' && numRes15.actionNumber === 15, '15 should resolve to NUMBERED_ACTION 15');
console.log('✔ [PASS] Numbered actions parsed accurately (1 to 15)');

// 7. Navigation
assert(resolveCommandIntent('b').type === 'NAV_BACK', 'b should resolve to NAV_BACK');
assert(resolveCommandIntent('back').type === 'NAV_BACK', 'back should resolve to NAV_BACK');
assert(resolveCommandIntent('q').type === 'NAV_EXIT', 'q should resolve to NAV_EXIT');
assert(resolveCommandIntent('quit').type === 'NAV_EXIT', 'quit should resolve to NAV_EXIT');
console.log('✔ [PASS] Navigation actions (back, exit) resolved successfully');

// 8. Unknown Commands
const unknownRes = resolveCommandIntent('xyzzy frobnicate');
assert(unknownRes.type === 'UNKNOWN', 'Gibberish should resolve to UNKNOWN');
assert(unknownRes.feedbackMessage.includes('Unknown command. Type `help`'), 'Unknown feedback message mismatch');
console.log('✔ [PASS] Unknown command properly reported with helpful guidance');

console.log('\n=========================================');
console.log('  ALL COMMAND-INTENT RESOLVER TESTS PASSED!');
console.log('=========================================\n');
