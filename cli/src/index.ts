import { AtlasApiClient } from './api-client';
import {
  getGlobalConfig,
  saveGlobalConfig,
  clearGlobalAuth,
  getLocalProjectConfig,
  saveLocalProjectConfig,
  removeLocalProjectConfig,
} from './config';
import { getLocalGitInfo, getGitInfo } from './git';
import { TerminalApp } from './tui/terminal-app';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const subCommand = args[1]?.toLowerCase();
const isJson = args.includes('--json');

// Monochrome ANSI styling helpers
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';

function printHeader() {
  if (isJson) return;
  console.log(`\n${bold}ATLAS DEVELOPER CLI${reset} ${dim}— AI Work Operating System${reset}`);
}

function printUsage() {
  printHeader();
  console.log(`
${bold}USAGE:${reset}
  atlas <command> [options]
  product <command> [options]

${bold}AUTHENTICATION & WORKSPACES:${reset}
  atlas login [--token <token>] [--url <url>]  Authenticate CLI with Developer API token
  atlas logout                                  Clear stored credentials
  atlas status                                  Check platform connection, active user & git repo
  atlas workspace list                          List accessible workspaces
  atlas workspace switch <id|slug>              Switch active workspace
  atlas doctor                                  System diagnostics & platform health check

${bold}REPOSITORIES:${reset}
  atlas connect [--repo <name>]                 Connect current directory Git repo to Atlas
  atlas disconnect                              Unlink local repository from Atlas
  atlas repo status                             Inspect local Git branch, commit & uncommitted changes
  atlas repos list                              List repositories registered in active workspace

${bold}TASKS & WORKFLOW:${reset}
  atlas tasks [--all] [--mine] [--status <s>]   List tasks for active workspace
  atlas task show <taskId>                      View task details, acceptance criteria & evidence
  atlas task claim <taskId> [--minutes <m>]     Claim exclusive lease on a task
  atlas task release <taskId>                   Release exclusive claim
  atlas task start <taskId>                     Claim task & transition status to IN_PROGRESS
  atlas task progress <taskId> <percent> [note] Update task completion percentage
  atlas task criteria <taskId> <critId> <done>  Toggle acceptance criterion (e.g. crit_1 true)
  atlas project list                            List active workspace projects

${bold}VERIFICATION & TASK COMPLETION:${reset}
  atlas checks list [taskId]                    List configured checks and required acceptance criteria
  atlas checks run <taskId> [--cmd <command>]   Run local validation check & capture real exit code
  atlas task submit <taskId> [--cmd <command>]  Run checks, attach git metadata, & submit evidence

${bold}ACTIVITY & TELEMETRY:${reset}
  atlas activity [--limit <n>]                  Stream recent workspace audit events & check history

${bold}AI DEVELOPER ASSISTANT:${reset}
  atlas ai plan <taskId>                        Generate structured implementation plan & test suite
  atlas ai pr <taskId>                          Draft pull request summary from task & evidence
  atlas ai handoff <taskId>                     Generate developer handoff summary

${bold}GLOBAL FLAGS:${reset}
  --json                                        Output machine-readable JSON for CI/scripting
`);
}

async function handleLogin() {
  printHeader();
  const tokenIdx = args.indexOf('--token');
  const urlIdx = args.indexOf('--url');

  let token = tokenIdx !== -1 ? args[tokenIdx + 1] : undefined;
  const url = urlIdx !== -1 ? args[urlIdx + 1] : undefined;

  if (!token && args[1] && !args[1].startsWith('--')) {
    token = args[1];
  }

  if (!token) {
    console.error(`\n${red}Error:${reset} Token required. Run: atlas login --token <your_token>`);
    console.log(`You can generate a developer token in Atlas Web: Settings -> Developer Tokens`);
    process.exit(1);
  }

  const client = new AtlasApiClient({
    apiUrl: url || getGlobalConfig().apiUrl,
    token,
  });

  console.log(`Validating token against Atlas at ${cyan}${url || getGlobalConfig().apiUrl}${reset}...`);
  const res = await client.getIdentity();

  if (!res.success || !res.data) {
    console.error(`\n${red}Authentication Failed:${reset} ${res.error?.message || 'Invalid token'}`);
    process.exit(1);
  }

  const { user, workspaces } = res.data;
  saveGlobalConfig({
    apiUrl: url || getGlobalConfig().apiUrl,
    token,
    userEmail: user.email,
    workspaceId: workspaces[0]?.id,
  });

  console.log(`\n${green}✓ Authenticated successfully!${reset}`);
  console.log(`  User:      ${bold}${user.displayName}${reset} (${user.email})`);
  console.log(`  Workspace: ${bold}${workspaces[0]?.name || 'Default'}${reset} (${workspaces[0]?.role})`);
  console.log(`\nNext: Run ${bold}atlas connect${reset} to link your repository.`);
}

async function handleLogout() {
  clearGlobalAuth();
  console.log(`\n${green}✓ Cleared Atlas credentials.${reset}`);
}

async function handleStatus() {
  printHeader();
  const config = getGlobalConfig();
  const git = getLocalGitInfo();
  const projectConfig = getLocalProjectConfig();

  console.log(`\n${bold}[CONNECTION & IDENTITY]${reset}`);
  console.log(`  Platform URL:    ${config.apiUrl}`);
  console.log(`  Auth State:      ${config.token ? `${green}Authenticated${reset} (${config.userEmail || 'Active'})` : `${yellow}Not logged in${reset}`}`);

  if (config.token) {
    const client = new AtlasApiClient(config);
    const res = await client.getIdentity();
    if (res.success && res.data) {
      const { user, workspaces, telemetry } = res.data;
      console.log(`  User:            ${user.displayName} (${user.email})`);
      console.log(`  Workspaces:      ${workspaces.map((w) => `${w.name} [${w.role}]`).join(', ')}`);
      console.log(`  Active Tasks:    ${telemetry.assignedTasksCount} assigned, ${telemetry.claimedTasksCount} claimed`);
    } else {
      console.log(`  ${red}Connection Check Failed:${reset} ${res.error?.message}`);
    }
  }

  console.log(`\n${bold}[LOCAL REPOSITORY]${reset}`);
  if (git.isGitRepo) {
    console.log(`  Repo Directory:  ${git.rootDir}`);
    console.log(`  Current Branch:  ${bold}${git.currentBranch}${reset}`);
    console.log(`  Latest Commit:   ${git.latestCommit || 'None'}`);
    console.log(`  Remote URL:      ${git.remoteUrl || 'No remote configured'}`);
    console.log(`  Uncommitted:     ${git.changedFiles.length} file(s) modified`);
  } else {
    console.log(`  ${dim}Not inside a Git repository.${reset}`);
  }

  if (projectConfig) {
    console.log(`\n${bold}[ATLAS PROJECT LINK]${reset}`);
    console.log(`  Linked Repo:     ${bold}${projectConfig.repoName}${reset}`);
    if (projectConfig.projectId) console.log(`  Linked Project:  ${projectConfig.projectId}`);
  }
  console.log('');
}

async function handleConnect() {
  printHeader();
  const git = getLocalGitInfo();
  const config = getGlobalConfig();

  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const repoNameIdx = args.indexOf('--repo');
  const projectIdx = args.indexOf('--project');

  const repoName = (repoNameIdx !== -1 ? args[repoNameIdx + 1] : undefined) || git.repoName || 'my-repository';
  const projectId = projectIdx !== -1 ? args[projectIdx + 1] : undefined;

  const client = new AtlasApiClient(config);
  console.log(`Connecting repository ${bold}"${repoName}"${reset} to Atlas...`);

  const res = await client.connectRepository({
    repoName,
    gitRemoteUrl: git.remoteUrl,
    currentBranch: git.currentBranch || 'main',
    localPath: git.rootDir || process.cwd(),
    projectId,
  });

  if (!res.success || !res.data) {
    console.error(`\n${red}Failed to connect repository:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  saveLocalProjectConfig({
    repoName: res.data.repository.name,
    repositoryId: res.data.repository.id,
    workspaceId: res.data.repository.workspaceId,
    projectId: res.data.repository.projectId,
  });

  console.log(`\n${green}✓ Repository connected successfully!${reset}`);
  console.log(`  Repository ID:   ${res.data.repository.id}`);
  console.log(`  Default Branch:  ${res.data.repository.defaultBranch}`);
  console.log(`  Project Config:  Saved to .atlas/project.json`);
  console.log(`\nNext: Run ${bold}atlas tasks${reset} to view work assigned to you.`);
}

async function handleTasks() {
  const config = getGlobalConfig();
  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const client = new AtlasApiClient(config);
  const statusIdx = args.indexOf('--status');
  const status = statusIdx !== -1 ? args[statusIdx + 1]?.toUpperCase() : undefined;

  const res = await client.listTasks({ status });

  if (!res.success || !res.data?.tasks) {
    console.error(`\n${red}Failed to fetch tasks:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const tasks = res.data.tasks;
  printHeader();
  console.log(`\n${bold}WORKSPACE TASKS${reset} (${tasks.length} total)\n`);

  if (tasks.length === 0) {
    console.log(`  ${dim}No matching tasks found in workspace.${reset}\n`);
    return;
  }

  console.log(`  ${bold}${'ID'.padEnd(12)} ${'STATUS'.padEnd(14)} ${'PRIORITY'.padEnd(10)} ${'TITLE'}${reset}`);
  console.log(`  ${dim}${'─'.repeat(70)}${reset}`);

  for (const t of tasks) {
    const claimPill = t.claimedById ? ` ${cyan}[CLAIMED]${reset}` : '';
    const critPill = t.acceptanceCriteria?.length ? ` ${dim}(${t.acceptanceCriteria.length} criteria)${reset}` : '';
    console.log(
      `  ${t.id.slice(0, 10).padEnd(12)} ${t.status.padEnd(14)} ${t.priority.padEnd(10)} ${t.title}${claimPill}${critPill}`
    );
  }
  console.log(`\nRun ${bold}atlas task show <taskId>${reset} to inspect details.\n`);
}

async function handleTaskShow(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas task show <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  const res = await client.getTask(taskId);

  if (!res.success || !res.data?.task) {
    console.error(`\n${red}Task not found:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const t = res.data.task;
  printHeader();
  console.log(`\n${bold}TASK DETAILS: ${t.title}${reset}`);
  console.log(`  ID:          ${t.id}`);
  console.log(`  Status:      ${bold}${t.status}${reset} (Priority: ${t.priority})`);
  console.log(`  Assignee:    ${t.assignee?.displayName || t.assignee?.email || 'Unassigned'}`);
  console.log(`  Project:     ${t.project?.name || 'None'}`);
  console.log(`  Verified:    ${t.isVerified ? `${green}✓ VERIFIED COMPLETE${reset}` : `${yellow}Pending verification${reset}`}`);

  if (t.claimedById) {
    console.log(`  Claim Lease: ${cyan}Claimed by ${t.claimedBy?.displayName || t.claimedBy?.email} (Expires: ${t.leaseExpiresAt})${reset}`);
  }

  if (t.description) {
    console.log(`\n${bold}DESCRIPTION:${reset}\n  ${t.description}`);
  }

  const criteria = (t.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];
  console.log(`\n${bold}ACCEPTANCE CRITERIA (${criteria.length}):${reset}`);
  if (criteria.length === 0) {
    console.log(`  ${dim}No acceptance criteria specified for this task.${reset}`);
  } else {
    for (const c of criteria) {
      const box = c.isCompleted ? `${green}[✓]${reset}` : `${red}[ ]${reset}`;
      console.log(`  ${box} ${bold}${c.id}${reset}: ${c.text}`);
    }
  }

  // Fetch evidence history
  const evRes = await client.getTaskEvidence(taskId);
  if (evRes.success && evRes.data?.evidence?.length) {
    console.log(`\n${bold}EXECUTION EVIDENCE HISTORY (${evRes.data.evidence.length}):${reset}`);
    for (const ev of evRes.data.evidence) {
      const badge = ev.status === 'PASSED' ? `${green}PASSED${reset}` : `${red}FAILED (code ${ev.exitCode})${reset}`;
      console.log(`  • ${badge} ${dim}${ev.executedAt}${reset}: \`${ev.command}\``);
      if (ev.commitHash) console.log(`    Commit: ${ev.commitHash} (Branch: ${ev.branch || 'main'})`);
    }
  }

  console.log(`\nCommands:`);
  console.log(`  ${bold}atlas task start ${t.id}${reset}   Start work`);
  console.log(`  ${bold}atlas checks run ${t.id}${reset}   Run local validation checks`);
  console.log(`  ${bold}atlas task submit ${t.id}${reset}  Run checks & submit evidence`);
  console.log(`  ${bold}atlas ai plan ${t.id}${reset}      Generate AI implementation plan\n`);
}

async function handleTaskClaim(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas task claim <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  const minIdx = args.indexOf('--minutes');
  const minutes = minIdx !== -1 ? parseInt(args[minIdx + 1], 10) : 120;

  console.log(`Claiming exclusive lease for task ${bold}${taskId}${reset}...`);
  const res = await client.claimTask(taskId, minutes);

  if (!res.success) {
    console.error(`\n${red}Failed to claim task:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  console.log(`\n${green}✓ ${res.data?.message || 'Task claimed successfully!'}${reset}`);
}

async function handleTaskRelease(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas task release <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  const res = await client.releaseTask(taskId);

  if (!res.success) {
    console.error(`\n${red}Failed to release task claim:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  console.log(`\n${green}✓ Task claim released.${reset}`);
}

async function handleTaskStart(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas task start <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  console.log(`Starting work on task ${bold}${taskId}${reset}...`);

  // Claim task first
  await client.claimTask(taskId, 120);
  const res = await client.updateTaskStatus(taskId, 'IN_PROGRESS');

  if (!res.success) {
    console.error(`\n${red}Failed to start task:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  console.log(`\n${green}✓ Task is now IN_PROGRESS!${reset}`);
  console.log(`Run ${bold}atlas task submit ${taskId}${reset} when development and tests are complete.`);
}

async function handleChecksRun(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas checks run <taskId> [--cmd <command>]`);
    process.exit(1);
  }

  const cmdIdx = args.indexOf('--cmd');
  const userCmd = cmdIdx !== -1 ? args[cmdIdx + 1] : 'npm test';

  printHeader();
  console.log(`\n${bold}RUNNING LOCAL VALIDATION CHECK:${reset} \`${cyan}${userCmd}${reset}\``);
  const startTime = Date.now();

  let exitCode = 0;
  let stdout = '';
  let stderr = '';

  try {
    stdout = execSync(userCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    exitCode = err.status || 1;
    stdout = err.stdout?.toString() || '';
    stderr = err.stderr?.toString() || err.message;
  }

  const durationMs = Date.now() - startTime;
  console.log(`\nExit Code: ${exitCode === 0 ? `${green}0 (SUCCESS)${reset}` : `${red}${exitCode} (FAILED)${reset}`} in ${durationMs}ms`);

  if (stdout) {
    console.log(`\n${dim}--- STDOUT SNIPPET ---${reset}\n${stdout.slice(0, 500)}${reset}`);
  }
  if (stderr) {
    console.log(`\n${red}--- STDERR SNIPPET ---${reset}\n${stderr.slice(0, 500)}${reset}`);
  }

  return { exitCode, stdout, stderr, command: userCmd };
}

async function handleTaskSubmit(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas task submit <taskId> [--cmd <command>]`);
    process.exit(1);
  }

  // 1. Run validation check locally
  const checkResult = await handleChecksRun(taskId);

  // 2. Collect Git metadata safely
  const git = getLocalGitInfo();
  console.log(`\n${bold}COLLECTING LOCAL EXECUTION EVIDENCE:${reset}`);
  console.log(`  Branch:          ${git.currentBranch || 'main'}`);
  console.log(`  Commit Hash:     ${git.latestCommit || 'HEAD'}`);
  console.log(`  Modified Files:  ${git.changedFiles.length} file(s)`);

  const client = new AtlasApiClient();
  console.log(`\nSubmitting verified evidence to Atlas platform...`);

  const res = await client.submitEvidence(taskId, {
    command: checkResult.command,
    exitCode: checkResult.exitCode,
    stdoutSnippet: checkResult.stdout.slice(0, 2000),
    stderrSnippet: checkResult.stderr.slice(0, 2000),
    commitHash: git.latestCommit,
    branch: git.currentBranch,
    changedFiles: git.changedFiles,
  });

  if (!res.success || !res.data) {
    console.error(`\n${red}Submission failed:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const { isVerified, status, missingCriteria, message } = res.data;

  if (isVerified) {
    console.log(`\n${green}✓ TASK VERIFIED COMPLETE!${reset}`);
    console.log(`  Status transitioned to: ${bold}${status}${reset}`);
    console.log(`  ${message}`);
  } else {
    console.log(`\n${yellow}⚠ TASK SUBMISSION RECORDED BUT NOT COMPLETED:${reset}`);
    console.log(`  ${message}`);
    if (missingCriteria?.length) {
      console.log(`\n  Missing Acceptance Criteria:`);
      for (const crit of missingCriteria) {
        console.log(`    ${red}•${reset} ${crit}`);
      }
    }
  }
  console.log('');
}

async function handleAiPlan(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas ai plan <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  console.log(`Synthesizing AI implementation plan for ${bold}${taskId}${reset}...`);
  const res = await client.getCodingPlan(taskId);

  if (!res.success || !res.data?.codingPlan) {
    console.error(`\n${red}Failed to generate plan:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const plan = res.data.codingPlan;
  printHeader();
  console.log(`\n${bold}AI IMPLEMENTATION PLAN: ${plan.task.title}${reset}`);
  console.log(`  Repository: ${plan.task.repository} | Branch: ${plan.task.branch}`);
  console.log(`\n${bold}ARCHITECTURE OVERVIEW:${reset}\n  ${plan.architectureOverview}\n`);

  console.log(`${bold}EXECUTION STEPS:${reset}`);
  for (const step of plan.implementationSteps) {
    console.log(`  ${cyan}${step.step}.${reset} ${bold}${step.title}${reset}`);
    console.log(`     ${step.description}`);
  }

  console.log(`\n${bold}RECOMMENDED TEST CASES:${reset}`);
  for (const tc of plan.recommendedTestCases) {
    console.log(`  ${green}•${reset} ${tc}`);
  }
  console.log('');
}

async function handleAiPr(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas ai pr <taskId>`);
    process.exit(1);
  }

  const git = getLocalGitInfo();
  const client = new AtlasApiClient();

  console.log(`Generating pull request draft for ${bold}${taskId}${reset}...`);
  const res = await client.getPullRequestDraft(taskId, git.latestCommit, git.currentBranch);

  if (!res.success || !res.data?.pullRequestDraft) {
    console.error(`\n${red}Failed to generate PR draft:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const pr = res.data.pullRequestDraft;
  printHeader();
  console.log(`\n${bold}GENERATED PULL REQUEST DRAFT:${reset}`);
  console.log(`\n${bold}TITLE:${reset} ${pr.title}`);
  console.log(`\n${bold}BODY:${reset}\n${pr.body}\n`);
}

async function handleAiHandoff(taskId: string) {
  if (!taskId) {
    console.error(`\n${red}Error:${reset} Task ID required. Run: atlas ai handoff <taskId>`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  if (!isJson) console.log(`Generating AI handoff summary for ${bold}${taskId}${reset}...`);
  const res = await client.getHandoffSummary(taskId);

  if (!res.success || !res.data?.handoffSummary) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    } else {
      console.error(`\n${red}Failed to generate handoff summary:${reset} ${res.error?.message}`);
    }
    process.exit(1);
  }

  const handoff = res.data.handoffSummary;
  if (isJson) {
    console.log(JSON.stringify(handoff, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}DEVELOPER HANDOFF SUMMARY: ${handoff.task.title}${reset}`);
  console.log(`  Assignee: ${handoff.task.assignee} | Status: ${handoff.task.status}`);
  console.log(`\n${bold}PROGRESS SUMMARY:${reset}\n  ${handoff.progressSummary}`);
  console.log(`\n${bold}CHANGED ARTIFACTS:${reset}`);
  for (const f of handoff.changedArtifacts || []) {
    console.log(`  • ${cyan}${f}${reset}`);
  }
  console.log(`\n${bold}NEXT RECOMMENDED ACTIONS:${reset}`);
  for (const step of handoff.nextSteps || []) {
    console.log(`  ${green}→${reset} ${step}`);
  }
  console.log('');
}

async function handleWorkspaceList() {
  const config = getGlobalConfig();
  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const client = new AtlasApiClient(config);
  const res = await client.getIdentity();

  if (!res.success || !res.data) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to fetch workspaces:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const { workspaces, activeWorkspaceId } = res.data;
  const currentId = config.workspaceId || activeWorkspaceId || workspaces[0]?.id;

  if (isJson) {
    console.log(JSON.stringify({ workspaces, currentWorkspaceId: currentId }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}ACCESSIBLE WORKSPACES${reset} (${workspaces.length} total)\n`);
  console.log(`  ${bold}${'ACTIVE'.padEnd(8)} ${'NAME'.padEnd(24)} ${'ROLE'.padEnd(12)} ${'ID'}${reset}`);
  console.log(`  ${dim}${'─'.repeat(70)}${reset}`);

  for (const w of workspaces) {
    const isCurrent = w.id === currentId;
    const activeMarker = isCurrent ? `${green}  *   ${reset}` : '      ';
    console.log(`${activeMarker} ${w.name.padEnd(24)} ${w.role.padEnd(12)} ${dim}${w.id}${reset}`);
  }
  console.log(`\nRun ${bold}atlas workspace switch <id|slug>${reset} to change active workspace.\n`);
}

async function handleWorkspaceSwitch(target: string) {
  if (!target) {
    console.error(`\n${red}Error:${reset} Workspace ID or slug required. Run: atlas workspace switch <id|slug>`);
    process.exit(1);
  }

  const config = getGlobalConfig();
  const client = new AtlasApiClient(config);
  const res = await client.getIdentity();

  if (!res.success || !res.data) {
    console.error(`\n${red}Failed to retrieve workspaces:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const found = res.data.workspaces.find(
    (w) => w.id === target || w.slug === target || w.name.toLowerCase() === target.toLowerCase()
  );

  if (!found) {
    console.error(`\n${red}Workspace not found:${reset} No workspace matches "${target}".`);
    process.exit(1);
  }

  saveGlobalConfig({ workspaceId: found.id });
  if (isJson) {
    console.log(JSON.stringify({ success: true, workspace: found }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${green}✓ Active workspace switched to:${reset} ${bold}${found.name}${reset} (${found.role})`);
  console.log(`  ID: ${found.id}\n`);
}

async function handleProjectList() {
  const config = getGlobalConfig();
  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const client = new AtlasApiClient(config);
  const res = await client.listProjects();

  if (!res.success || !res.data?.projects) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to list projects:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const projects = res.data.projects;
  if (isJson) {
    console.log(JSON.stringify({ projects }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}WORKSPACE PROJECTS${reset} (${projects.length} total)\n`);
  if (projects.length === 0) {
    console.log(`  ${dim}No projects registered in current workspace.${reset}\n`);
    return;
  }

  console.log(`  ${bold}${'ID'.padEnd(12)} ${'NAME'.padEnd(28)} ${'STATUS'.padEnd(12)} ${'TASKS'}${reset}`);
  console.log(`  ${dim}${'─'.repeat(70)}${reset}`);

  for (const p of projects) {
    const taskCount = p._count?.tasks ?? (p.tasks?.length || 0);
    console.log(`  ${p.id.slice(0, 10).padEnd(12)} ${p.name.slice(0, 26).padEnd(28)} ${(p.status || 'ACTIVE').padEnd(12)} ${taskCount}`);
  }
  console.log('');
}

async function handleTaskProgress(taskId: string, percentStr: string, note?: string) {
  if (!taskId || !percentStr) {
    console.error(`\n${red}Error:${reset} Task ID and progress percentage required. Run: atlas task progress <taskId> <0-100> [note]`);
    process.exit(1);
  }

  const percent = parseInt(percentStr, 10);
  if (isNaN(percent) || percent < 0 || percent > 100) {
    console.error(`\n${red}Error:${reset} Progress must be an integer between 0 and 100.`);
    process.exit(1);
  }

  const client = new AtlasApiClient();
  const res = await client.updateTaskProgress(taskId, percent, note);

  if (!res.success) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to update progress:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  if (isJson) {
    console.log(JSON.stringify({ success: true, taskId, progress: percent }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${green}✓ Task progress updated to ${percent}%${reset}`);
  if (note) console.log(`  Note: ${note}`);
  console.log('');
}

async function handleTaskCriteria(taskId: string, critId: string, doneStr: string) {
  if (!taskId || !critId) {
    console.error(`\n${red}Error:${reset} Task ID and criterion ID required. Run: atlas task criteria <taskId> <critId> <true|false>`);
    process.exit(1);
  }

  const isCompleted = doneStr === 'true' || doneStr === '1' || doneStr === 'yes';
  const client = new AtlasApiClient();
  const taskRes = await client.getTask(taskId);

  if (!taskRes.success || !taskRes.data?.task) {
    console.error(`\n${red}Task not found:${reset} ${taskRes.error?.message}`);
    process.exit(1);
  }

  const criteria = (taskRes.data.task.acceptanceCriteria || []) as Array<{ id: string; text: string; isCompleted: boolean }>;
  const existingIdx = criteria.findIndex((c) => c.id === critId);

  if (existingIdx !== -1) {
    criteria[existingIdx].isCompleted = isCompleted;
  } else {
    criteria.push({ id: critId, text: `Criterion ${critId}`, isCompleted });
  }

  const res = await client.updateTaskCriteria(taskId, criteria);
  if (!res.success) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to update criteria:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  if (isJson) {
    console.log(JSON.stringify({ success: true, taskId, criteria }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${green}✓ Updated criterion "${critId}" to ${isCompleted ? 'SATISFIED [✓]' : 'PENDING [ ]'}${reset}\n`);
}

async function handleChecksList(taskId?: string) {
  const client = new AtlasApiClient();

  if (taskId) {
    const taskRes = await client.getTask(taskId);
    const evRes = await client.getTaskEvidence(taskId);

    if (isJson) {
      console.log(JSON.stringify({
        task: taskRes.data?.task,
        criteria: taskRes.data?.task?.acceptanceCriteria || [],
        evidence: evRes.data?.evidence || [],
      }, null, 2));
      return;
    }

    printHeader();
    console.log(`\n${bold}CHECKS & CRITERIA FOR TASK ${taskId}${reset}`);
    const criteria = (taskRes.data?.task?.acceptanceCriteria || []) as any[];
    console.log(`\n${bold}Acceptance Criteria (${criteria.length}):${reset}`);
    if (criteria.length === 0) {
      console.log(`  ${dim}None defined.${reset}`);
    } else {
      for (const c of criteria) {
        console.log(`  ${c.isCompleted ? `${green}[✓]` : `${red}[ ]`} ${c.id}: ${c.text}${reset}`);
      }
    }

    const ev = evRes.data?.evidence || [];
    console.log(`\n${bold}Executed Checks History (${ev.length}):${reset}`);
    for (const item of ev) {
      const badge = item.status === 'PASSED' ? `${green}PASSED${reset}` : `${red}FAILED (${item.exitCode})${reset}`;
      console.log(`  • ${badge} \`${item.command}\` at ${item.executedAt}`);
    }
    console.log('');
    return;
  }

  // Standard repo checks overview
  const standardChecks = [
    { name: 'Unit & Integration Tests', command: 'npm test', recommended: true },
    { name: 'TypeScript Compilation', command: 'npx tsc --noEmit', recommended: true },
    { name: 'Code Style & Linting', command: 'npm run lint', recommended: false },
    { name: 'Production Build', command: 'npm run build', recommended: false },
  ];

  if (isJson) {
    console.log(JSON.stringify({ standardChecks }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}CONFIGURED REPOSITORY CHECKS:${reset}\n`);
  for (const c of standardChecks) {
    console.log(`  ${bold}${c.name.padEnd(28)}${reset} \`${cyan}${c.command}${reset}\``);
  }
  console.log(`\nRun ${bold}atlas checks run <taskId> --cmd "<command>"${reset} to execute against a task.\n`);
}

async function handleActivity(limitStr?: string) {
  const config = getGlobalConfig();
  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  const client = new AtlasApiClient(config);
  const res = await client.getActivity(limit);

  if (!res.success || !res.data?.activities) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to fetch activity stream:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const activities = res.data.activities;
  if (isJson) {
    console.log(JSON.stringify({ activities }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}RECENT WORKSPACE AUDIT & ACTIVITY TIMELINE${reset} (${activities.length} events)\n`);
  if (activities.length === 0) {
    console.log(`  ${dim}No recent activity recorded.${reset}\n`);
    return;
  }

  for (const act of activities) {
    const time = new Date(act.timestamp).toLocaleTimeString();
    const actor = act.actor?.displayName || act.actor?.email || 'System';
    let badge = `${dim}[${act.action}]${reset}`;
    if (act.action === 'EVIDENCE_SUBMITTED') badge = `${green}[VERIFY]${reset}`;
    else if (act.action === 'CLAIMED') badge = `${cyan}[CLAIM]${reset}`;
    else if (act.action === 'STATUS_CHANGED') badge = `${yellow}[STATUS]${reset}`;

    console.log(`  ${dim}${time}${reset} ${badge.padEnd(16)} ${bold}${actor}${reset}: ${act.details || act.taskTitle || 'Activity'}`);
  }
  console.log('');
}

async function handleReposList() {
  const config = getGlobalConfig();
  if (!config.token) {
    console.error(`\n${red}Error:${reset} Please log in first: ${bold}atlas login --token <token>${reset}`);
    process.exit(1);
  }

  const client = new AtlasApiClient(config);
  const res = await client.listRepositories();

  if (!res.success || !res.data?.repositories) {
    if (isJson) console.log(JSON.stringify({ success: false, error: res.error }, null, 2));
    else console.error(`\n${red}Failed to list repositories:${reset} ${res.error?.message}`);
    process.exit(1);
  }

  const repos = res.data.repositories;
  if (isJson) {
    console.log(JSON.stringify({ repositories: repos }, null, 2));
    return;
  }

  printHeader();
  console.log(`\n${bold}WORKSPACE CONNECTED REPOSITORIES${reset} (${repos.length} total)\n`);
  if (repos.length === 0) {
    console.log(`  ${dim}No repositories registered. Run 'atlas connect' to link current repo.${reset}\n`);
    return;
  }

  console.log(`  ${bold}${'ID'.padEnd(12)} ${'NAME'.padEnd(24)} ${'BRANCH'.padEnd(14)} ${'REMOTE URL'}${reset}`);
  console.log(`  ${dim}${'─'.repeat(70)}${reset}`);

  for (const r of repos) {
    console.log(`  ${r.id.slice(0, 10).padEnd(12)} ${r.name.slice(0, 22).padEnd(24)} ${(r.defaultBranch || 'main').padEnd(14)} ${dim}${r.gitRemoteUrl || 'Local only'}${reset}`);
  }
  console.log('');
}

async function handleDisconnect() {
  const unlinked = removeLocalProjectConfig();
  if (isJson) {
    console.log(JSON.stringify({ success: true, unlinked }, null, 2));
    return;
  }

  printHeader();
  if (unlinked) {
    console.log(`\n${green}✓ Successfully unlinked repository from Atlas.${reset}`);
    console.log(`  Removed .atlas/project.json. Local Git files and source tree untouched.\n`);
  } else {
    console.log(`\n${yellow}No active repository link found in this directory (.atlas/project.json).${reset}\n`);
  }
}

async function handleDoctor() {
  printHeader();
  console.log(`\n${bold}ATLAS SYSTEM DIAGNOSTICS & DOCTOR${reset}`);
  console.log(`${dim}Checking local developer environment and platform connectivity...${reset}\n`);

  // 1. Node runtime
  console.log(`• Node.js Version: ${green}${process.version}${reset}`);

  // 2. Git CLI
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
    console.log(`• Git CLI:         ${green}Detected (${gitVersion})${reset}`);
  } catch {
    console.log(`• Git CLI:         ${red}Not found or not in PATH${reset}`);
  }

  // 3. Local Repository
  const git = getGitInfo();
  if (git.isGitRepo) {
    console.log(`• Local Git Repo:  ${green}Active (${git.currentBranch} @ ${git.latestCommit?.slice(0, 7)})${reset}`);
    console.log(`• Changed Files:   ${git.changedFiles.length} file(s)`);
  } else {
    console.log(`• Local Git Repo:  ${yellow}Not in a git repository${reset}`);
  }

  // 4. Server API Connectivity
  const config = getGlobalConfig();
  console.log(`• API Endpoint:    ${cyan}${config.apiUrl}${reset}`);
  try {
    const res = await fetch(`${config.apiUrl}/health`).catch(() => null);
    if (res && res.ok) {
      console.log(`• Platform Status: ${green}Online (HTTP 200 OK)${reset}`);
    } else {
      console.log(`• Platform Status: ${yellow}Reachable, returned non-200${reset}`);
    }
  } catch {
    console.log(`• Platform Status: ${red}Unreachable (Connection refused)${reset}`);
  }

  // 5. Auth & Workspace
  if (config.token) {
    const client = new AtlasApiClient();
    const ident = await client.getIdentity();
    if (ident.success && ident.data) {
      console.log(`• Authentication:  ${green}Verified as ${ident.data.user.displayName} (${ident.data.user.email})${reset}`);
      console.log(`• Workspaces:      ${ident.data.workspaces?.length || 0} accessible`);
      console.log(`\n${green}${bold}[STATUS: HEALTHY]${reset} Local environment and Atlas platform are fully operational.\n`);
    } else {
      console.log(`• Authentication:  ${red}Token invalid or expired${reset}`);
    }
  } else {
    console.log(`• Authentication:  ${yellow}Not authenticated. Run 'atlas login' or start TUI.${reset}`);
  }
}

// Router
async function main() {
  if (!command) {
    // Interactive TUI launch when called without arguments in an interactive terminal
    if (process.stdout.isTTY) {
      const app = new TerminalApp();
      await app.start();
      return;
    }
    printUsage();
    return;
  }

  switch (command) {
    case 'interactive':
    case 'tui':
    case 'app': {
      const app = new TerminalApp();
      await app.start();
      break;
    }
    case 'doctor':
      await handleDoctor();
      break;
    case 'login':
      await handleLogin();
      break;
    case 'logout':
      await handleLogout();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'workspaces':
    case 'workspace':
      if (subCommand === 'list' || !subCommand) await handleWorkspaceList();
      else if (subCommand === 'switch') await handleWorkspaceSwitch(args[2]);
      else printUsage();
      break;
    case 'projects':
    case 'project':
      if (subCommand === 'list' || !subCommand) await handleProjectList();
      else printUsage();
      break;
    case 'connect':
      await handleConnect();
      break;
    case 'disconnect':
      await handleDisconnect();
      break;
    case 'tasks':
      await handleTasks();
      break;
    case 'task':
      if (subCommand === 'show') await handleTaskShow(args[2]);
      else if (subCommand === 'claim') await handleTaskClaim(args[2]);
      else if (subCommand === 'release') await handleTaskRelease(args[2]);
      else if (subCommand === 'start') await handleTaskStart(args[2]);
      else if (subCommand === 'progress') await handleTaskProgress(args[2], args[3], args[4]);
      else if (subCommand === 'criteria') await handleTaskCriteria(args[2], args[3], args[4]);
      else if (subCommand === 'submit') await handleTaskSubmit(args[2]);
      else printUsage();
      break;
    case 'checks':
      if (subCommand === 'run') await handleChecksRun(args[2]);
      else if (subCommand === 'list' || !subCommand) await handleChecksList(args[2]);
      else printUsage();
      break;
    case 'activity':
      await handleActivity(subCommand || args[1]);
      break;
    case 'ai':
      if (subCommand === 'plan') await handleAiPlan(args[2]);
      else if (subCommand === 'pr') await handleAiPr(args[2]);
      else if (subCommand === 'handoff') await handleAiHandoff(args[2]);
      else printUsage();
      break;
    case 'repos':
    case 'repo':
      if (subCommand === 'status' || !subCommand) await handleStatus();
      else if (subCommand === 'list') await handleReposList();
      else printUsage();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printUsage();
      break;
  }
}

main().catch((err) => {
  console.error(`\n${red}Fatal Error:${reset}`, err.message);
  process.exit(1);
});

