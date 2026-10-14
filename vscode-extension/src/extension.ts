import * as vscode from 'vscode';
import { AtlasExtensionApi } from './api';
import { AtlasTaskProvider, AtlasTreeItem } from './taskProvider';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  const api = new AtlasExtensionApi();
  const taskProvider = new AtlasTaskProvider(api);

  vscode.window.registerTreeDataProvider('atlas.tasksView', taskProvider);

  // Command: Set Token
  const loginCmd = vscode.commands.registerCommand('atlas.login', async () => {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your Atlas Developer API Token (starts with atlas_dev_)',
      password: true,
      ignoreFocusOut: true,
    });

    if (token) {
      await vscode.workspace.getConfiguration('atlas').update('developerToken', token, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Atlas: Developer token configured successfully!');
      taskProvider.refresh();
    }
  });

  // Command: Refresh
  const refreshCmd = vscode.commands.registerCommand('atlas.refreshTasks', () => {
    taskProvider.refresh();
  });

  // Command: Start Task
  const startCmd = vscode.commands.registerCommand('atlas.startTask', async (item: AtlasTreeItem) => {
    if (!item?.task) return;
    try {
      await api.claimTask(item.task.id);
      await api.updateTaskStatus(item.task.id, 'IN_PROGRESS');
      vscode.window.showInformationMessage(`Atlas: Started work on "${item.task.title}"`);
      taskProvider.refresh();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Atlas: ${err.message}`);
    }
  });

  // Command: Run Checks locally
  const runChecksCmd = vscode.commands.registerCommand('atlas.runChecks', async (item: AtlasTreeItem) => {
    if (!item?.task) return;
    const command = await vscode.window.showInputBox({
      prompt: 'Enter validation check command to run in terminal',
      value: 'npm test',
    });

    if (!command) return;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Atlas: Running "${command}" for ${item.task.title}...`,
        cancellable: false,
      },
      async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        try {
          const { stdout } = await execAsync(command, { cwd: root });
          vscode.window.showInformationMessage(`Atlas: Checks PASSED! Exit code 0.\n${stdout.slice(0, 100)}...`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Atlas: Checks FAILED with code ${err.code || 1}!\n${(err.stderr || err.message).slice(0, 100)}...`);
        }
      }
    );
  });

  // Command: Submit Task Evidence
  const submitCmd = vscode.commands.registerCommand('atlas.submitTask', async (item: AtlasTreeItem) => {
    if (!item?.task) return;

    const command = await vscode.window.showInputBox({
      prompt: 'Enter verification check command to execute and submit',
      value: 'npm test',
    });

    if (!command) return;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Atlas: Verifying and submitting evidence for ${item.task.title}...`,
        cancellable: false,
      },
      async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        let exitCode = 0;
        let stdout = '';
        let stderr = '';

        try {
          const res = await execAsync(command, { cwd: root });
          stdout = res.stdout;
        } catch (err: any) {
          exitCode = err.code || 1;
          stdout = err.stdout || '';
          stderr = err.stderr || err.message;
        }

        try {
          const result = await api.submitEvidence(item.task!.id, {
            command,
            exitCode,
            stdoutSnippet: stdout.slice(0, 1000),
            stderrSnippet: stderr.slice(0, 1000),
          });

          if (result.isVerified) {
            vscode.window.showInformationMessage(`✓ Atlas: Task verified and marked DONE!`);
          } else {
            vscode.window.showWarningMessage(`Atlas: Evidence recorded. ${result.message}`);
          }
          taskProvider.refresh();
        } catch (err: any) {
          vscode.window.showErrorMessage(`Atlas: Failed to submit evidence: ${err.message}`);
        }
      }
    );
  });

  // Command: AI Coding Plan
  const aiPlanCmd = vscode.commands.registerCommand('atlas.aiPlan', async (item: AtlasTreeItem) => {
    if (!item?.task) return;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Atlas AI: Synthesizing plan for ${item.task.title}...`,
        cancellable: false,
      },
      async () => {
        try {
          const plan = await api.getAiCodingPlan(item.task!.id);
          const doc = await vscode.workspace.openTextDocument({
            content: `# AI Implementation Plan: ${plan.task.title}\n\n` +
                     `**Overview**:\n${plan.architectureOverview}\n\n` +
                     `## Execution Steps:\n` +
                     plan.implementationSteps.map((s: any) => `### ${s.step}. ${s.title}\n${s.description}`).join('\n\n') +
                     `\n\n## Recommended Test Cases:\n` +
                     plan.recommendedTestCases.map((tc: string) => `- [ ] ${tc}`).join('\n'),
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Atlas AI: ${err.message}`);
        }
      }
    );
  });

  // Command: Launch Task Completion Wizard (Guided 10-Step Workflow)
  const wizardCmd = vscode.commands.registerCommand('atlas.completionWizard', async (item?: AtlasTreeItem) => {
    let targetTask = item?.task;

    if (!targetTask) {
      try {
        const tasks = await api.getAssignedTasks();
        if (!tasks.length) {
          vscode.window.showInformationMessage('Atlas: No tasks found in active workspace.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          tasks.map((t: any) => ({
            label: `[${t.status}] ${t.title}`,
            description: t.id,
            task: t,
          })),
          { placeHolder: 'Select task to begin the 10-step Completion Wizard' }
        );
        if (!pick) return;
        targetTask = pick.task;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Atlas: Could not load tasks: ${err.message}`);
        return;
      }
    }

    if (!targetTask) return;

    // Step 1: Confirm Task Requirements
    const proceed = await vscode.window.showInformationMessage(
      `Atlas Completion Wizard (Step 1/10)\nTask: "${targetTask.title}" (${targetTask.status})\nReady to verify acceptance criteria and execute checks?`,
      'Proceed',
      'Cancel'
    );
    if (proceed !== 'Proceed') return;

    // Step 2: Inspect Acceptance Criteria
    const criteria = (targetTask.acceptanceCriteria || []) as Array<{ id: string; text: string; isCompleted: boolean }>;
    const pendingCrit = criteria.filter((c) => !c.isCompleted);
    if (pendingCrit.length > 0) {
      const critProceed = await vscode.window.showWarningMessage(
        `Atlas (Step 2/10): ${pendingCrit.length} acceptance criteria are currently unmet:\n` +
        pendingCrit.map((c) => `• ${c.text}`).join('\n'),
        'Run Checks Anyway',
        'Cancel'
      );
      if (critProceed !== 'Run Checks Anyway') return;
    }

    // Step 3-5: Configure & Execute Verification Check
    const command = await vscode.window.showInputBox({
      prompt: 'Atlas (Step 5/10): Enter local test/verification command to execute',
      value: 'npm test',
    });
    if (!command) return;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Atlas (Steps 5-7/10): Executing "${command}" locally...`,
        cancellable: false,
      },
      async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        let exitCode = 0;
        let stdout = '';
        let stderr = '';

        try {
          const res = await execAsync(command, { cwd: root });
          stdout = res.stdout;
        } catch (err: any) {
          exitCode = err.code || 1;
          stdout = err.stdout || '';
          stderr = err.stderr || err.message;
        }

        // Step 6-8: Submit Evidence to Backend
        try {
          const result = await api.submitEvidence(targetTask.id, {
            command,
            exitCode,
            stdoutSnippet: stdout.slice(0, 1500),
            stderrSnippet: stderr.slice(0, 1500),
          });

          // Step 9-10: Show Server-Confirmed Result
          if (result.isVerified) {
            vscode.window.showInformationMessage(
              `✓ Atlas (Step 10/10): Task "${targetTask.title}" verified and marked DONE! Server confirmed.`
            );
          } else {
            vscode.window.showWarningMessage(
              `Atlas (Step 10/10): Evidence recorded. Server policy: ${result.message}`
            );
          }
          taskProvider.refresh();
        } catch (err: any) {
          vscode.window.showErrorMessage(`Atlas: Evidence submission failed: ${err.message}`);
        }
      }
    );
  });

  // Command: Disconnect / Clear Credentials
  const disconnectCmd = vscode.commands.registerCommand('atlas.disconnect', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to disconnect from Atlas and clear your developer token?',
      'Disconnect',
      'Cancel'
    );
    if (confirm === 'Disconnect') {
      await vscode.workspace.getConfiguration('atlas').update('developerToken', '', vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Atlas: Disconnected and credentials cleared.');
      taskProvider.refresh();
    }
  });

  // Status Bar Integration
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'atlas.refreshTasks';
  statusBar.text = '$(rocket) Atlas';
  statusBar.tooltip = 'Atlas Developer Workspace — Click to refresh tasks';
  statusBar.show();

  context.subscriptions.push(loginCmd, refreshCmd, startCmd, runChecksCmd, submitCmd, aiPlanCmd, wizardCmd, disconnectCmd, statusBar);
}

export function deactivate() {}

