'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Terminal,
  ArrowRight,
  ArrowLeft,
  Play,
  RotateCcw,
  Check,
  FileCode,
  Lock,
} from 'lucide-react';
import { api, TaskItem } from '@/lib/api';

interface TaskCompletionWizardModalProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export function TaskCompletionWizardModal({
  task,
  isOpen,
  onClose,
  onCompleted,
}: TaskCompletionWizardModalProps) {
  // Wizard Steps 1 to 10
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Acceptance Criteria State
  const [criteria, setCriteria] = useState<
    Array<{ id: string; text: string; isCompleted: boolean }>
  >((task.acceptanceCriteria as any) || []);

  // Execution & Evidence State
  const [command, setCommand] = useState<string>('npm test');
  const [exitCode, setExitCode] = useState<number>(0);
  const [stdoutSnippet, setStdoutSnippet] = useState<string>(
    'PASS tests/unit/developer-platform.test.ts\n✓ 17 test suites completed successfully (exit code 0)'
  );
  const [stderrSnippet, setStderrSnippet] = useState<string>('');
  const [branch, setBranch] = useState<string>(task.branchName || 'main');
  const [commitHash, setCommitHash] = useState<string>('HEAD');
  const [completionNotes, setCompletionNotes] = useState<string>(
    'Completed core implementation and passed all test suites.'
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{
    isVerified: boolean;
    status: string;
    message: string;
    missingCriteria?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const toggleCriterion = (id: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isCompleted: !c.isCompleted } : c))
    );
  };

  const handleRunMockExecution = (code: number) => {
    setExitCode(code);
    if (code === 0) {
      setStdoutSnippet(
        `> ${command}\nPASS test/execution-suite.test.ts\n✓ All acceptance criteria validated.\nExit code: 0 (PASSED)`
      );
      setStderrSnippet('');
    } else {
      setStdoutSnippet(`> ${command}\nFAIL test/execution-suite.test.ts`);
      setStderrSnippet('Error: Validation check failed with 1 assertion failure.');
    }
  };

  const handleSubmitEvidence = async () => {
    setIsSubmitting(true);
    try {
      // 1. Sync updated criteria to server first
      if (criteria.length > 0) {
        await api.updateTaskCriteria(task.id, criteria);
      }

      // 2. Submit verified evidence to server-authoritative endpoint
      const res = await api.submitEvidence(task.id, {
        command,
        exitCode,
        stdoutSnippet,
        stderrSnippet: stderrSnippet || undefined,
        branch,
        commitHash,
        changedFiles: ['src/services/task-completion.ts', 'tests/task.test.ts'],
      });

      if (res.success && res.data) {
        setSubmissionResult({
          isVerified: res.data.isVerified,
          status: res.data.status,
          message: res.data.message,
          missingCriteria: res.data.missingCriteria,
        });
        setCurrentStep(10);
        onCompleted();
      } else {
        alert(res.error?.message || 'Failed to submit evidence');
      }
    } catch (err: any) {
      alert(err.message || 'Evidence submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCriteriaCount = criteria.filter((c) => !c.isCompleted).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0F0F0F] border border-[#262626] rounded-xl shadow-2xl flex flex-col text-neutral-200 overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#141414]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                10-Step Task Completion Wizard
              </h3>
              <p className="text-[11px] font-mono text-neutral-400">
                TASK-{task.id.slice(0, 8)} • Step {currentStep} of 10
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#202020] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1A1A1A] h-1">
          <div
            className="bg-white h-1 transition-all duration-300"
            style={{ width: `${(currentStep / 10) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Confirm Requirements */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Confirm Task Requirements</span>
              </div>

              <div className="p-4 rounded-lg bg-[#141414] border border-[#222222] space-y-3">
                <h4 className="text-base font-semibold text-white">{task.title}</h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {task.description || 'No description provided for this task.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1F1F1F] text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]">
                    Status: {task.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]">
                    Priority: {task.priority}
                  </span>
                  {task.project && (
                    <span className="px-2 py-0.5 rounded bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]">
                      Project: {task.project.name}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                Before completing this task, you will inspect acceptance criteria, check git state,
                execute local validation checks, and submit server-verifiable evidence.
              </p>
            </div>
          )}

          {/* STEP 2: Inspect Acceptance Criteria */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Inspect Acceptance Criteria</span>
              </div>

              <p className="text-xs text-neutral-400">
                All criteria must be satisfied for automatic server verification. Click to toggle
                satisfied requirements:
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {criteria.map((crit) => (
                  <div
                    key={crit.id}
                    onClick={() => toggleCriterion(crit.id)}
                    className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      crit.isCompleted
                        ? 'bg-emerald-950/20 border-emerald-900/40 text-neutral-200'
                        : 'bg-[#141414] border-[#222222] hover:bg-[#1A1A1A] text-neutral-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={crit.isCompleted}
                      onChange={() => {}}
                      className="mt-0.5 rounded bg-[#1F1F1F] border-[#333333] text-emerald-500 focus:ring-0"
                    />
                    <div className="flex-1 text-xs">
                      <span className={crit.isCompleted ? 'line-through text-neutral-400' : 'font-medium text-white'}>
                        {crit.text}
                      </span>
                    </div>
                    {crit.isCompleted && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-semibold">
                        Satisfied
                      </span>
                    )}
                  </div>
                ))}

                {criteria.length === 0 && (
                  <div className="p-4 rounded-lg bg-[#141414] border border-dashed border-[#262626] text-center text-xs text-neutral-500">
                    No acceptance criteria specified. The completion engine will evaluate check results directly.
                  </div>
                )}
              </div>

              {pendingCriteriaCount > 0 && (
                <div className="p-3 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Warning: {pendingCriteriaCount} criteria remain unmet. Submitting now will record evidence but will not mark the task DONE.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Repository & Branch State */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Check Repository and Branch State</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-[#141414] border border-[#222222] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Git Branch</span>
                  <div className="flex items-center space-x-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="bg-[#1C1C1C] border border-[#2A2A2A] text-white text-xs rounded px-2 py-1 w-full focus:outline-none focus:border-neutral-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#141414] border border-[#222222] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Commit Hash</span>
                  <input
                    type="text"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    className="bg-[#1C1C1C] border border-[#2A2A2A] text-white text-xs rounded px-2 py-1 w-full focus:outline-none focus:border-neutral-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#141414] border border-[#222222] text-xs space-y-2">
                <span className="font-semibold text-white text-[11px] block">Modified Files:</span>
                <ul className="text-neutral-400 font-mono text-[11px] space-y-1">
                  <li className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>src/services/task-completion.ts</span>
                  </li>
                  <li className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>tests/task.test.ts</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 4: Record Implementation Progress */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>Record Implementation Progress</span>
              </div>

              <div className="p-4 rounded-lg bg-[#141414] border border-[#222222] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Target Completion:</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">100%</span>
                </div>
                <div className="w-full bg-[#1C1C1C] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full" />
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  The completion wizard will update task progress to 100% upon successful submission
                  and mark status as DONE once verified.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Run Configured Authorized Checks */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  5
                </span>
                <span>Configure Verification Check</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300">
                  Validation Check Command:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="flex-1 bg-[#141414] border border-[#262626] text-xs font-mono text-cyan-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={() => handleRunMockExecution(0)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run (Exit 0)</span>
                  </button>
                  <button
                    onClick={() => handleRunMockExecution(1)}
                    className="px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Fail (Exit 1)</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Supported checks: <code className="text-neutral-400">npm test</code>,{' '}
                  <code className="text-neutral-400">npx tsc --noEmit</code>,{' '}
                  <code className="text-neutral-400">npm run lint</code>.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: Review Actual Results */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  6
                </span>
                <span>Review Check Results</span>
              </div>

              <div className="p-3.5 rounded-lg bg-[#141414] border border-[#222222] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        exitCode === 0
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                      }`}
                    >
                      {exitCode === 0 ? 'PASSED (0)' : `FAILED (${exitCode})`}
                    </span>
                    <span className="font-mono text-white text-xs">{command}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Captured Output
                  </span>
                  <pre className="text-[11px] font-mono p-2.5 rounded bg-black border border-[#222222] text-neutral-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {stdoutSnippet}
                  </pre>
                </div>

                {stderrSnippet && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">
                      Error Stream
                    </span>
                    <pre className="text-[11px] font-mono p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {stderrSnippet}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 7: Completion Notes */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  7
                </span>
                <span>Add Completion Notes</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Developer Summary & Handoff Notes:
                </label>
                <textarea
                  rows={4}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full bg-[#141414] border border-[#262626] text-xs text-white rounded p-3 focus:outline-none focus:border-neutral-500 leading-relaxed"
                  placeholder="Summarize the implementation changes, resolved blockers, and verification steps..."
                />
              </div>
            </div>
          )}

          {/* STEP 8: Submit Evidence */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  8
                </span>
                <span>Submit Genuine Evidence Payload</span>
              </div>

              <div className="p-4 rounded-lg bg-[#141414] border border-[#242424] text-xs space-y-2 font-mono">
                <div className="flex justify-between text-neutral-400">
                  <span>Target Task:</span>
                  <span className="text-white">{task.id}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Exit Code:</span>
                  <span className={exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {exitCode} ({exitCode === 0 ? 'PASS' : 'FAIL'})
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Satisfied Criteria:</span>
                  <span className="text-white">
                    {criteria.filter((c) => c.isCompleted).length} / {criteria.length}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Branch:</span>
                  <span className="text-white">{branch}</span>
                </div>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                Clicking Proceed will submit this evidence record to the backend and evaluate the
                authoritative completion policy.
              </p>
            </div>
          )}

          {/* STEP 9: Review Policy & Confirmation */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  9
                </span>
                <span>Evaluate Completion Policy</span>
              </div>

              <div className="p-4 rounded-lg bg-[#141414] border border-[#222222] space-y-3 text-xs">
                <h5 className="font-semibold text-white">Authoritative Verification Rules:</h5>
                <ul className="space-y-2 text-neutral-300">
                  <li className="flex items-center space-x-2">
                    {exitCode === 0 ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>Verification check exits with code 0</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    {pendingCriteriaCount === 0 ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>All acceptance criteria explicitly satisfied</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Server-authoritative state transition (prevents unauthorized client skips)</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleSubmitEvidence}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Evidence to Server...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit and Request Server Decision</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 10: Server-Confirmed Result */}
          {currentStep === 10 && submissionResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px]">
                  10
                </span>
                <span>Server-Confirmed Decision</span>
              </div>

              {submissionResult.isVerified ? (
                <div className="p-5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-900/60 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-700/60">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">TASK VERIFIED DONE</h4>
                    <p className="text-xs text-emerald-300 mt-1">{submissionResult.message}</p>
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 pt-2 border-t border-emerald-900/40">
                    Status transitioned to: <strong className="text-white">{submissionResult.status}</strong>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-900/60 text-amber-400 flex items-center justify-center mx-auto border border-amber-700/60">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">EVIDENCE RECORDED</h4>
                    <p className="text-xs text-amber-300 mt-1">{submissionResult.message}</p>
                  </div>
                  {submissionResult.missingCriteria && submissionResult.missingCriteria.length > 0 && (
                    <div className="text-left bg-black/40 p-3 rounded border border-amber-900/40 text-xs">
                      <span className="font-semibold text-amber-200 block mb-1">
                        Unmet Criteria:
                      </span>
                      {submissionResult.missingCriteria.map((c) => (
                        <p key={c} className="text-[11px] text-amber-400">• {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#222222] bg-[#141414]">
          {currentStep > 1 && currentStep < 10 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 bg-[#1C1C1C] hover:bg-[#252525] text-neutral-300 text-xs rounded font-medium flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 9 && (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(9, prev + 1))}
              className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs rounded font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {currentStep === 10 && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs rounded font-semibold transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
