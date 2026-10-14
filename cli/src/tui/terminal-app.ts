import readline from 'readline';
import { getGlobalConfig, saveGlobalConfig, clearGlobalConfig } from '../config';
import { AtlasApiClient } from '../api-client';
import { getGitInfo } from '../git';
import { resolveCommandIntent, normalizeInput } from '../intent-resolver';

// ANSI styling helpers for monochrome developer aesthetic
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  white: '\x1b[37m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bgDark: '\x1b[40m',
  clear: '\x1b[2J\x1b[0;0H',
};

export class TerminalApp {
  private rl: readline.Interface;
  private client: AtlasApiClient;
  private user: any = null;
  private workspaces: any[] = [];
  private activeWorkspaceId: string | null = null;
  private isRunning = true;
  private currentScreen: 'WELCOME' | 'DASHBOARD' | 'TASKS' | 'TASK_DETAIL' | 'REPOS' | 'CHECKS' | 'AI' = 'WELCOME';
  private selectedTaskId: string | null = null;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.client = new AtlasApiClient();
  }

  private prompt(query: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }

  private async promptSecret(query: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(query);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode?.(true);
      stdin.resume();

      let input = '';
      const onData = (char: Buffer) => {
        const s = char.toString();
        if (s === '\n' || s === '\r' || s === '\u0004') {
          stdin.setRawMode?.(wasRaw);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
        } else if (s === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
        } else if (s === '\b' || s === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += s;
          process.stdout.write('*');
        }
      };

      stdin.on('data', onData);
    });
  }

  private drawHeader(title = 'DEVELOPER OPERATING SYSTEM') {
    process.stdout.write(c.clear);
    console.log(`${c.bold}${c.white}┌────────────────────────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.bold}${c.white}│  PROJECT ATLAS  ◈  ${title.padEnd(52)}│${c.reset}`);
    console.log(`${c.bold}${c.white}├────────────────────────────────────────────────────────────────────────┤${c.reset}`);
    if (this.user) {
      const userLine = `User: ${this.user.displayName} (${this.user.email})`;
      const ws = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
      const wsLine = `Workspace: ${ws ? ws.name : 'Personal'}`;
      console.log(`${c.dim}│  ${userLine.padEnd(34)} │  ${wsLine.padEnd(34)}│${c.reset}`);
      console.log(`${c.bold}${c.white}├────────────────────────────────────────────────────────────────────────┤${c.reset}`);
    }
  }

  private drawFooter() {
    console.log(`${c.bold}${c.white}└────────────────────────────────────────────────────────────────────────┘${c.reset}`);
  }

  public async start() {
    // Check initial connection and identity
    const config = getGlobalConfig();
    if (config.token) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const identity = await this.client.getIdentity();
          if (identity.success && identity.data?.user) {
            this.user = identity.data.user;
            this.workspaces = identity.data.workspaces || [];
            this.activeWorkspaceId = identity.data.activeWorkspaceId || config.workspaceId || (this.workspaces[0]?.id ?? null);
            this.currentScreen = 'DASHBOARD';
            break;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    while (this.isRunning) {
      try {
        switch (this.currentScreen) {
          case 'WELCOME':
            await this.screenWelcome();
            break;
          case 'DASHBOARD':
            await this.screenDashboard();
            break;
          case 'TASKS':
            await this.screenTasks();
            break;
          case 'TASK_DETAIL':
            await this.screenTaskDetail();
            break;
          case 'REPOS':
            await this.screenRepositories();
            break;
          case 'CHECKS':
            await this.screenChecks();
            break;
          case 'AI':
            await this.screenAI();
            break;
          default:
            this.currentScreen = 'DASHBOARD';
        }
      } catch (err: any) {
        console.error(`${c.red}[ERROR]: ${err.message}${c.reset}`);
        await this.prompt('\nPress Enter to continue...');
      }
    }

    this.rl.close();
    console.log(`\n${c.dim}Project Atlas session ended. Goodbye.${c.reset}\n`);
  }

  // ─── 1. Welcome Screen (Login / Register) ──────────────────────────────────
  private async screenWelcome() {
    const config = getGlobalConfig();
    if (config.token && !this.user) {
      process.stdout.write(`${c.dim}Validating saved session for ${config.userEmail || 'user'}...${c.reset} `);
      const ident = await this.client.getIdentity();
      if (ident.success && ident.data?.user) {
        this.user = ident.data.user;
        this.workspaces = ident.data.workspaces || [];
        this.activeWorkspaceId = ident.data.activeWorkspaceId || config.workspaceId || (this.workspaces[0]?.id ?? null);
        console.log(`${c.green}✔ Active session restored!${c.reset}`);
        this.currentScreen = 'DASHBOARD';
        return;
      }
      console.log(`${c.yellow}(Session expired or server offline - please authenticate)${c.reset}\n`);
    }
    this.drawHeader('WELCOME & AUTHENTICATION');
    console.log(`│                                                                        │`);
    console.log(`│  Connect your local terminal and repository directly to your team's   │`);
    console.log(`│  central AI Developer Workspace.                                       │`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.cyan}[1]${c.reset} ${c.bold}Log In with Email & Password${c.reset}                                    │`);
    console.log(`│  ${c.cyan}[2]${c.reset} ${c.bold}Create Account (Register)${c.reset}                                       │`);
    console.log(`│  ${c.cyan}[3]${c.reset} ${c.bold}Authenticate with Developer Token (atlas_dev_...)${c.reset}             │`);
    console.log(`│  ${c.cyan}[4]${c.reset} ${c.bold}Check Connection & Server Status${c.reset}                                │`);
    console.log(`│  ${c.cyan}[q]${c.reset} Exit                                                                   │`);
    console.log(`│                                                                        │`);
    this.drawFooter();

    const choice = (await this.prompt(`\n${c.bold}Select an option [1-4, q]: ${c.reset}`)).trim().toLowerCase();

    if (choice === 'q') {
      this.isRunning = false;
      return;
    }

    if (choice === '1') {
      // Interactive Login
      console.log(`\n${c.bold}── Log In to Atlas Platform ──${c.reset}`);
      const email = await this.prompt('Email: ');
      const password = await this.promptSecret('Password: ');

      if (!email.trim() || !password.trim()) {
        console.log(`${c.red}Email and password are required.${c.reset}`);
        await this.prompt('Press Enter to retry...');
        return;
      }

      process.stdout.write(`${c.dim}Authenticating...${c.reset} `);
      const res = await this.client.loginWithCredentials(email.trim(), password.trim());
      if (res.success && res.data?.token) {
        saveGlobalConfig({
          token: res.data.token,
          userEmail: res.data.user.email,
        });
        this.client = new AtlasApiClient();
        const ident = await this.client.getIdentity();
        if (ident.success && ident.data) {
          this.user = ident.data.user;
          this.workspaces = ident.data.workspaces || [];
          this.activeWorkspaceId = ident.data.activeWorkspaceId || (this.workspaces[0]?.id ?? null);
        }
        console.log(`${c.green}✔ Logged in as ${res.data.user.displayName}!${c.reset}`);
        this.currentScreen = 'DASHBOARD';
        await new Promise((r) => setTimeout(r, 800));
      } else {
        console.log(`\n${c.red}✖ ${res.error?.message || 'Login failed'}${c.reset}`);
        await this.prompt('Press Enter to continue...');
      }
    } else if (choice === '2') {
      // Interactive Register
      console.log(`\n${c.bold}── Create Account on Atlas Platform ──${c.reset}`);
      const displayName = await this.prompt('Full Name: ');
      const email = await this.prompt('Email: ');
      const password = await this.promptSecret('Password: ');
      const confirmPassword = await this.promptSecret('Confirm Password: ');

      if (password !== confirmPassword) {
        console.log(`${c.red}Passwords do not match.${c.reset}`);
        await this.prompt('Press Enter to retry...');
        return;
      }

      process.stdout.write(`${c.dim}Creating account...${c.reset} `);
      const res = await this.client.register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });

      if (res.success && res.data?.token) {
        saveGlobalConfig({
          token: res.data.token,
          userEmail: res.data.user.email,
        });
        this.client = new AtlasApiClient();
        const ident = await this.client.getIdentity();
        if (ident.success && ident.data) {
          this.user = ident.data.user;
          this.workspaces = ident.data.workspaces || [];
          this.activeWorkspaceId = ident.data.activeWorkspaceId || (this.workspaces[0]?.id ?? null);
        }
        console.log(`${c.green}✔ Account created successfully! Welcome, ${res.data.user.displayName}.${c.reset}`);
        this.currentScreen = 'DASHBOARD';
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        console.log(`\n${c.red}✖ ${res.error?.message || 'Registration failed'}${c.reset}`);
        await this.prompt('Press Enter to continue...');
      }
    } else if (choice === '3') {
      // Connect via token
      const token = await this.prompt('\nPaste your Developer Token (atlas_dev_...): ');
      if (token.trim()) {
        saveGlobalConfig({ token: token.trim() });
        this.client = new AtlasApiClient();
        const ident = await this.client.getIdentity();
        if (ident.success && ident.data) {
          this.user = ident.data.user;
          this.workspaces = ident.data.workspaces || [];
          this.activeWorkspaceId = ident.data.activeWorkspaceId || (this.workspaces[0]?.id ?? null);
          console.log(`${c.green}✔ Connected to workspace!${c.reset}`);
          this.currentScreen = 'DASHBOARD';
          await new Promise((r) => setTimeout(r, 800));
        } else {
          console.log(`${c.red}Invalid developer token or server unreachable.${c.reset}`);
          await this.prompt('Press Enter to continue...');
        }
      }
    } else if (choice === '4') {
      // Check server status
      const config = getGlobalConfig();
      console.log(`\nChecking server at ${config.apiUrl}...`);
      try {
        const res = await fetch(`${config.apiUrl}/health`).catch(() => null);
        if (res && res.ok) {
          console.log(`${c.green}✔ Server is online and responding.${c.reset}`);
        } else {
          console.log(`${c.yellow}Server reachable, but health endpoint returned non-200.${c.reset}`);
        }
      } catch {
        console.log(`${c.red}✖ Server is offline or unreachable at ${config.apiUrl}${c.reset}`);
      }
      await this.prompt('Press Enter to continue...');
    }
  }

  // ─── 2. Main Dashboard Screen ──────────────────────────────────────────────
  private async screenDashboard() {
    this.drawHeader('DEVELOPER DASHBOARD');
    const git = getGitInfo();

    // Fetch live telemetry & tasks summary
    const ident = await this.client.getIdentity();
    const tasksRes = await this.client.listTasks();
    const tasks = tasksRes.data?.tasks || [];

    const todoCount = tasks.filter((t) => t.status === 'TODO').length;
    const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const verifiedDoneCount = tasks.filter((t) => t.status === 'DONE' && t.isVerified).length;
    const claimedCount = tasks.filter((t) => t.claimedById === this.user?.id).length;

    console.log(`│  ${c.bold}LOCAL REPOSITORY & GIT:${c.reset}                                              │`);
    const repoLine = git.isGitRepo
      ? `Branch: ${git.currentBranch} | Commit: ${git.latestCommit?.slice(0, 7) || 'none'}`
      : 'No git repository detected in current working directory.';
    console.log(`│  ${c.cyan}${repoLine.padEnd(70)}${c.reset}│`);
    console.log(`│  Uncommitted files: ${String(git.changedFiles.length).padEnd(49)}│`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.bold}WORKSPACE TASK TELEMETRY:${c.reset}                                             │`);
    console.log(`│  • Tasks In Progress:  ${c.yellow}${String(inProgressCount).padEnd(5)} ${c.reset}│  • To Do:         ${String(todoCount).padEnd(16)}│`);
    console.log(`│  • Claimed By You:     ${c.cyan}${String(claimedCount).padEnd(5)} ${c.reset}│  • Verified Done: ${c.green}${String(verifiedDoneCount).padEnd(16)}${c.reset}│`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.bold}NAVIGATION & WORKFLOWS:${c.reset}                                               │`);
    console.log(`│  ${c.cyan}[1]${c.reset} View & Claim Assigned Tasks                                      │`);
    console.log(`│  ${c.cyan}[2]${c.reset} Repository Management & Linking                                  │`);
    console.log(`│  ${c.cyan}[3]${c.reset} Execute Local Checks & Submit Verified Evidence                  │`);
    console.log(`│  ${c.cyan}[4]${c.reset} AI Developer Assistant (Plans, PR Drafts, Reviews)             │`);
    console.log(`│  ${c.cyan}[5]${c.reset} Switch Active Workspace                                          │`);
    console.log(`│  ${c.cyan}[0]${c.reset} Log Out                                                          │`);
    console.log(`│  ${c.cyan}[q]${c.reset} Exit Terminal TUI                                                │`);
    console.log(`│                                                                        │`);
    this.drawFooter();

    const choice = (await this.prompt(`\n${c.bold}Command [1-5, 0, q]: ${c.reset}`)).trim().toLowerCase();

    if (choice === 'q') {
      this.isRunning = false;
    } else if (choice === '1') {
      this.currentScreen = 'TASKS';
    } else if (choice === '2') {
      this.currentScreen = 'REPOS';
    } else if (choice === '3') {
      this.currentScreen = 'CHECKS';
    } else if (choice === '4') {
      this.currentScreen = 'AI';
    } else if (choice === '5') {
      await this.actionSwitchWorkspace();
    } else if (choice === '0') {
      clearGlobalConfig();
      this.user = null;
      this.currentScreen = 'WELCOME';
    }
  }

  // ─── 3. Tasks Screen ───────────────────────────────────────────────────────
  private async screenTasks() {
    this.drawHeader('WORKSPACE TASKS');
    const tasksRes = await this.client.listTasks();
    const tasks = tasksRes.data?.tasks || [];

    console.log(`│  ${c.dim}${'#'.padEnd(4)} ${'CANONICAL ID'.padEnd(26)} ${'STATUS'.padEnd(14)} ${'PRIORITY'.padEnd(10)} ${'TITLE'.padEnd(20)}${c.reset}│`);
    console.log(`│  ${''.padEnd(76, '─')}│`);

    tasks.slice(0, 15).forEach((t: any, index: number) => {
      const idxStr = `[${index + 1}]`.padEnd(4);
      const canonicalId = `TASK-${t.id}`;
      const shortDisplayId = canonicalId.length > 24 ? canonicalId.slice(0, 21) + '...' : canonicalId;
      const statusStr = t.isVerified ? `VERIFIED` : t.status;
      const titleStr = t.title.length > 20 ? t.title.slice(0, 17) + '...' : t.title;

      let statusColor = c.white;
      if (t.isVerified || t.status === 'DONE') statusColor = c.green;
      else if (t.status === 'IN_PROGRESS') statusColor = c.yellow;
      else if (t.status === 'IN_REVIEW') statusColor = c.cyan;
      else if (t.status === 'TODO') statusColor = c.white;

      console.log(
        `│  ${c.cyan}${idxStr}${c.reset} ${shortDisplayId.padEnd(25)} ${statusColor}${statusStr.padEnd(14)}${c.reset} ${t.priority.padEnd(10)} ${titleStr.padEnd(20)}│`
      );
    });

    if (tasks.length === 0) {
      console.log(`│  No tasks found in active workspace.                                   │`);
    }

    console.log(`│                                                                        │`);
    console.log(`│  ${c.dim}Select by number [1-${Math.min(tasks.length, 15)}], canonical ID, or command ('complete 1', 'b'):${c.reset} │`);
    this.drawFooter();

    const rawChoice = await this.prompt(`\n${c.bold}Command or task selection: ${c.reset}`);
    const intent = resolveCommandIntent(rawChoice);

    if (intent.type === 'NAV_BACK') {
      this.currentScreen = 'DASHBOARD';
      return;
    }
    if (intent.type === 'NAV_EXIT') {
      this.isRunning = false;
      return;
    }

    // Direct task lookup by canonical ID or partial ID
    const cleanRaw = rawChoice.trim();
    const cleanId = cleanRaw.replace(/^TASK-/i, '');

    // Check if input was a number index [1..N]
    const num = parseInt(cleanRaw, 10);
    if (!isNaN(num) && num >= 1 && num <= tasks.length) {
      this.selectedTaskId = tasks[num - 1].id;
      this.currentScreen = 'TASK_DETAIL';
      return;
    }

    // Check direct task ID match
    const matchingTask = tasks.find((t: any) => t.id === cleanId || t.id.startsWith(cleanId) || `TASK-${t.id}`.toLowerCase() === cleanRaw.toLowerCase());
    if (matchingTask) {
      this.selectedTaskId = matchingTask.id;
      this.currentScreen = 'TASK_DETAIL';
      return;
    }

    // Check if input had command intent with target task
    if (intent.targetTaskId) {
      const targetClean = intent.targetTaskId.replace(/^TASK-/i, '');
      const matched = tasks.find((t: any) => t.id === targetClean || t.id.startsWith(targetClean));
      if (matched) {
        this.selectedTaskId = matched.id;
        if (intent.type === 'COMPLETE') {
          console.log(`\n${c.green}${intent.feedbackMessage}${c.reset}`);
          await this.actionTaskCompletionWizard(matched);
          return;
        }
        this.currentScreen = 'TASK_DETAIL';
        return;
      }
    }

    // Check if user entered command + index (e.g. "complete 1")
    const matchCmdIndex = cleanRaw.match(/^([a-z\s]+)\s+(\d+)$/i);
    if (matchCmdIndex) {
      const cmdPart = matchCmdIndex[1].trim();
      const taskIndex = parseInt(matchCmdIndex[2], 10);
      if (taskIndex >= 1 && taskIndex <= tasks.length) {
        const subIntent = resolveCommandIntent(cmdPart);
        const targetTask = tasks[taskIndex - 1];
        this.selectedTaskId = targetTask.id;
        if (subIntent.type === 'COMPLETE') {
          console.log(`\n${c.green}${subIntent.feedbackMessage}${c.reset}`);
          await this.actionTaskCompletionWizard(targetTask);
          return;
        }
        this.currentScreen = 'TASK_DETAIL';
        return;
      }
    }

    console.log(`\n${c.yellow}Could not resolve task from input "${cleanRaw}". Select [1-${tasks.length}] or canonical ID.${c.reset}`);
    await this.prompt('Press Enter to refresh...');
  }

  // ─── 4. Task Detail & Execution ───────────────────────────────────────────
  private async screenTaskDetail() {
    if (!this.selectedTaskId) {
      this.currentScreen = 'TASKS';
      return;
    }

    const res = await this.client.getTask(this.selectedTaskId);
    const task = res.data?.task;

    if (!task) {
      console.log(`${c.red}Task not found.${c.reset}`);
      this.currentScreen = 'TASKS';
      return;
    }

    const canonicalId = `TASK-${task.id}`;
    const criteria = (task.acceptanceCriteria as any[]) || [];
    const satisfiedCount = criteria.filter((c: any) => c.isCompleted).length;
    const criteriaDisplay = criteria.length === 0
      ? 'Not configured'
      : `${satisfiedCount}/${criteria.length} satisfied`;

    let claimDisplay = 'Unclaimed';
    if (task.claimedById) {
      if (task.claimedById === this.user?.id) {
        claimDisplay = 'Active (You hold this claim lease)';
      } else {
        claimDisplay = `Active (Claimed by ${task.claimedBy?.displayName || task.claimedBy?.email || 'team member'})`;
      }
    }

    const verifyDisplay = task.isVerified
      ? `${c.green}Verified Complete${c.reset}`
      : `${c.yellow}Pending${c.reset}`;

    process.stdout.write(c.clear);
    console.log(`${c.bold}${c.white}PROJECT ATLAS — TASK COMPLETION CENTER${c.reset}\n`);
    console.log(`Task:                ${c.cyan}${c.bold}${canonicalId}${c.reset}`);
    console.log(`Title:               ${c.bold}${task.title}${c.reset}`);
    console.log(`Status:              ${task.status === 'DONE' ? c.green : c.yellow}${task.status}${c.reset}`);
    console.log(`Claim:               ${claimDisplay}`);
    console.log(`Acceptance criteria: ${criteriaDisplay}`);
    console.log(`Verification:        ${verifyDisplay}`);
    console.log(`\n${c.bold}AVAILABLE ACTIONS${c.reset}\n`);
    console.log(`  ${c.cyan}[1]${c.reset}  View task requirements`);
    console.log(`  ${c.cyan}[2]${c.reset}  Manage acceptance criteria`);
    console.log(`  ${c.cyan}[3]${c.reset}  View implementation progress`);
    console.log(`  ${c.cyan}[4]${c.reset}  Inspect repository and Git status`);
    console.log(`  ${c.cyan}[5]${c.reset}  Run approved verification checks`);
    console.log(`  ${c.cyan}[6]${c.reset}  Review check results`);
    console.log(`  ${c.cyan}[7]${c.reset}  Add completion notes`);
    console.log(`  ${c.cyan}[8]${c.reset}  Attach or select evidence`);
    console.log(`  ${c.cyan}[9]${c.reset}  Submit task for review`);
    console.log(`  ${c.cyan}[10]${c.reset} View review feedback`);
    console.log(`  ${c.cyan}[11]${c.reset} Verify completion eligibility`);
    console.log(`  ${c.cyan}[12]${c.reset} Refresh task status`);
    console.log(`  ${c.cyan}[13]${c.reset} Release task claim`);
    console.log(`  ${c.cyan}[14]${c.reset} Generate AI implementation plan`);
    console.log(`  ${c.cyan}[15]${c.reset} Help and keyboard shortcuts`);
    console.log(`  ${c.cyan}[b]${c.reset}  Back`);
    console.log(`  ${c.cyan}[q]${c.reset}  Exit`);

    const rawInput = await this.prompt(`\n${c.bold}Action [1-15, b, q, or command]: ${c.reset}`);
    const intent = resolveCommandIntent(rawInput);

    if (intent.type === 'NAV_BACK') {
      this.currentScreen = 'TASKS';
      return;
    }
    if (intent.type === 'NAV_EXIT') {
      this.isRunning = false;
      return;
    }

    // Completion Aliases: 'complete', 'completed', 'done', 'finish', 'finished', 'mark complete', etc.
    if (intent.type === 'COMPLETE') {
      console.log(`\n${c.green}${intent.feedbackMessage}${c.reset}`);
      await this.actionTaskCompletionWizard(task);
      return;
    }

    // Submit Aliases: 'submit', 'submit task'
    if (intent.type === 'SUBMIT') {
      console.log(`\n${c.cyan}${intent.feedbackMessage}${c.reset}`);
      await this.actionAttachEvidence(task);
      return;
    }

    // Submit for Review Aliases: 'submit for review', 'review'
    if (intent.type === 'SUBMIT_FOR_REVIEW') {
      console.log(`\n${c.cyan}${intent.feedbackMessage}${c.reset}`);
      await this.actionSubmitForReview(task);
      return;
    }

    // Verify Aliases: 'verify', 'verification', 'test', 'run checks'
    if (intent.type === 'VERIFY') {
      console.log(`\n${c.cyan}${intent.feedbackMessage}${c.reset}`);
      await this.actionCheckEligibility(task);
      return;
    }

    // Status Aliases: 'check status', 'status', 'refresh'
    if (intent.type === 'CHECK_STATUS') {
      console.log(`\n${c.cyan}${intent.feedbackMessage}${c.reset}`);
      await this.actionRefreshStatus(task);
      return;
    }

    // Help Aliases: 'help', '?', 'commands', 'shortcuts'
    if (intent.type === 'HELP') {
      await this.actionShowHelp();
      return;
    }

    // Numbered Actions [1-15]
    if (intent.type === 'NUMBERED_ACTION' && intent.actionNumber !== undefined) {
      const num = intent.actionNumber;
      if (num < 1 || num > 15) {
        console.log(`\n${c.red}Invalid action number [${num}]. Please enter a number between 1 and 15, or type 'help'.${c.reset}`);
        await this.prompt('Press Enter to redisplay available actions...');
        return;
      }

      switch (num) {
        case 1:
          await this.actionViewRequirements(task);
          break;
        case 2:
          await this.actionManageCriteria(task);
          break;
        case 3:
          await this.actionViewProgress(task);
          break;
        case 4:
          await this.actionInspectGit(task);
          break;
        case 5:
          await this.actionRunVerificationChecks(task);
          break;
        case 6:
          await this.actionReviewCheckResults(task);
          break;
        case 7:
          await this.actionAddCompletionNotes(task);
          break;
        case 8:
          await this.actionAttachEvidence(task);
          break;
        case 9:
          await this.actionSubmitForReview(task);
          break;
        case 10:
          await this.actionViewReviewFeedback(task);
          break;
        case 11:
          await this.actionCheckEligibility(task);
          break;
        case 12:
          await this.actionRefreshStatus(task);
          break;
        case 13:
          await this.actionReleaseClaim(task);
          break;
        case 14:
          await this.actionGenerateAIPlan(task);
          break;
        case 15:
          await this.actionShowHelp();
          break;
      }
      return;
    }

    // Truly unknown command
    console.log(`\n${c.yellow}Unknown command "${rawInput.trim()}". Type 'help' to see available commands.${c.reset}`);
    await this.prompt('Press Enter to continue...');
  }

  // ─── Numbered Action [1]: View Task Requirements ───────────────────────────
  private async actionViewRequirements(task: any) {
    console.log(`\n${c.bold}=== TASK REQUIREMENTS: TASK-${task.id} ===${c.reset}`);
    console.log(`Title:       ${task.title}`);
    console.log(`Description: ${task.description || '(No description provided)'}`);
    console.log(`Status:      ${task.status}`);
    console.log(`Priority:    ${task.priority}`);
    console.log(`Assignee:    ${task.assignee?.displayName || task.assignee?.email || 'Unassigned'}`);
    console.log(`Project:     ${task.project?.name || 'Default Project'}`);
    console.log(`Branch:      ${task.branchName || 'Not linked'}`);
    console.log(`Verified:    ${task.isVerified ? 'Yes' : 'No'}`);

    const criteria = (task.acceptanceCriteria as any[]) || [];
    console.log(`\n${c.bold}Acceptance Criteria (${criteria.length}):${c.reset}`);
    if (criteria.length === 0) {
      console.log(`  Acceptance criteria are not configured.`);
    } else {
      criteria.forEach((crit: any, idx: number) => {
        const mark = crit.isCompleted ? `${c.green}[✔]${c.reset}` : `[ ]`;
        console.log(`  ${mark} (${idx + 1}) ${crit.text}`);
      });
    }

    // State-aware claim prompt
    if (!task.claimedById) {
      const claim = (await this.prompt(`\nTask is unclaimed. Claim and start work now? [Y/n]: `)).trim().toLowerCase();
      if (claim !== 'n') {
        const claimRes = await this.client.claimTask(task.id);
        if (claimRes.success) {
          await this.client.updateTaskStatus(task.id, 'IN_PROGRESS');
          console.log(`${c.green}✔ Claimed & started! Task is now IN_PROGRESS.${c.reset}`);
        } else {
          console.log(`${c.red}✖ ${claimRes.error?.message || 'Failed to claim'}${c.reset}`);
        }
      }
    } else if (task.claimedById === this.user?.id) {
      console.log(`\n${c.cyan}You hold an active claim lease on this task. Task is in progress.${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [2]: Manage Acceptance Criteria ───────────────────────
  private async actionManageCriteria(task: any) {
    let criteria = (task.acceptanceCriteria as any[]) || [];
    console.log(`\n${c.bold}=== MANAGE ACCEPTANCE CRITERIA ===${c.reset}`);
    if (criteria.length === 0) {
      console.log(`\n${c.yellow}Acceptance criteria are not configured.${c.reset}`);
      console.log(`[a] Add acceptance criterion`);
      console.log(`[b] Back`);
    } else {
      criteria.forEach((crit: any, idx: number) => {
        const mark = crit.isCompleted ? `${c.green}[✔] Satisfied${c.reset}` : `${c.red}[ ] Incomplete${c.reset}`;
        console.log(`  [${idx + 1}] ${mark} — ${crit.text}`);
      });
      console.log(`\nOptions: Enter criterion number [1-${criteria.length}] to toggle, [a] to add, [b] to return.`);
    }

    const choice = (await this.prompt(`\nSelect option: `)).trim().toLowerCase();
    if (choice === 'b') return;

    if (choice === 'a') {
      const newText = (await this.prompt('Enter new criterion requirement: ')).trim();
      if (newText) {
        const updated = [...criteria, { id: `crit_${Date.now().toString(36)}`, text: newText, isCompleted: false }];
        const res = await this.client.updateTaskCriteria(task.id, updated);
        if (res.success) {
          console.log(`${c.green}✔ Criterion added successfully.${c.reset}`);
        } else {
          console.log(`${c.red}✖ Failed: ${res.error?.message}${c.reset}`);
        }
      }
      await this.prompt('Press Enter to return...');
      return;
    }

    const critNum = parseInt(choice, 10);
    if (!isNaN(critNum) && critNum >= 1 && critNum <= criteria.length) {
      const target = criteria[critNum - 1];
      target.isCompleted = !target.isCompleted;
      const res = await this.client.updateTaskCriteria(task.id, criteria);
      if (res.success) {
        console.log(`${c.green}✔ Criterion (${critNum}) marked as ${target.isCompleted ? 'SATISFIED' : 'INCOMPLETE'}.${c.reset}`);
      } else {
        console.log(`${c.red}✖ Failed: ${res.error?.message}${c.reset}`);
      }
      await this.prompt('Press Enter to return...');
    }
  }

  // ─── Numbered Action [3]: View Implementation Progress ─────────────────────
  private async actionViewProgress(task: any) {
    const git = getGitInfo();
    const progress = task.progress ?? (task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0);
    const bars = Math.round(progress / 5);
    const progressBar = `[${'█'.repeat(bars)}${'░'.repeat(20 - bars)}] ${progress}%`;

    console.log(`\n${c.bold}=== IMPLEMENTATION PROGRESS ===${c.reset}`);
    console.log(`Task:             TASK-${task.id}`);
    console.log(`Current Progress: ${c.cyan}${progressBar}${c.reset}`);
    console.log(`Current Status:   ${task.status}`);
    console.log(`Git Modified:     ${git.changedFiles.length} file(s)`);
    console.log(`Latest Commit:    ${git.latestCommit || 'None'}`);

    const newProg = (await this.prompt(`\nUpdate progress percentage (0-100) or press Enter to keep: `)).trim();
    if (newProg) {
      const p = parseInt(newProg, 10);
      if (!isNaN(p) && p >= 0 && p <= 100) {
        await this.client.updateTaskProgress(task.id, p);
        console.log(`${c.green}✔ Progress updated to ${p}%.${c.reset}`);
      }
    }
    await this.prompt('Press Enter to return...');
  }

  // ─── Numbered Action [4]: Inspect Repository and Git Status ────────────────
  private async actionInspectGit(task: any) {
    const git = getGitInfo();
    console.log(`\n${c.bold}=== REPOSITORY AND GIT STATUS ===${c.reset}`);
    console.log(`Local Path:      ${git.rootDir || process.cwd()}`);
    console.log(`Current Branch:  ${c.cyan}${git.currentBranch || 'None'}${c.reset}`);
    if (task.branchName && task.branchName !== git.currentBranch) {
      console.log(`Linked Branch:   ${c.yellow}${task.branchName} (Branch mismatch!)${c.reset}`);
    }
    console.log(`Latest Commit:   ${git.latestCommit || 'None'}`);
    console.log(`Remote URL:      ${git.remoteUrl || 'No remote configured'}`);
    console.log(`Working Tree:    ${git.changedFiles.length === 0 ? `${c.green}Clean (0 uncommitted files)${c.reset}` : `${c.yellow}${git.changedFiles.length} uncommitted file(s)${c.reset}`}`);

    if (git.changedFiles.length > 0) {
      console.log(`\n${c.yellow}Uncommitted Changes:${c.reset}`);
      git.changedFiles.slice(0, 10).forEach((f) => console.log(`  • ${f}`));
      if (git.changedFiles.length > 10) {
        console.log(`  ... and ${git.changedFiles.length - 10} more files`);
      }
      console.log(`\n${c.yellow}Note: Commit your changes before requesting final review or completion.${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [5]: Run Approved Verification Checks ─────────────────
  private async actionRunVerificationChecks(task: any) {
    console.log(`\n${c.bold}=== RUN APPROVED VERIFICATION CHECKS ===${c.reset}`);
    console.log(`Configured validation checks for task TASK-${task.id}:`);
    console.log(`  [1] npm test (Default Test Suite)`);
    console.log(`  [2] npm run typecheck (Type Validation)`);
    console.log(`  [3] Custom Shell Command`);

    const sel = (await this.prompt(`\nSelect check [1-3, or Enter for 1]: `)).trim();
    let cmd = 'npm test';
    if (sel === '2') cmd = 'npm run typecheck';
    else if (sel === '3') {
      cmd = (await this.prompt('Enter custom validation command: ')).trim() || 'npm test';
    }

    // Explicit confirmation required
    const confirm = (await this.prompt(`Execute: "$ ${cmd}"? [Y/n]: `)).trim().toLowerCase();
    if (confirm === 'n') {
      console.log('Execution cancelled.');
      await this.prompt('Press Enter to return...');
      return;
    }

    console.log(`\n${c.cyan}Running check: $ ${cmd}${c.reset}\n`);
    const { execSync } = await import('child_process');
    const startTime = Date.now();
    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    try {
      stdout = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
      process.stdout.write(stdout);
    } catch (err: any) {
      exitCode = err.status || 1;
      stdout = err.stdout?.toString() || '';
      stderr = err.stderr?.toString() || err.message;
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${c.bold}Execution Completed:${c.reset}`);
    console.log(`Duration:  ${duration}s`);
    console.log(`Exit Code: ${exitCode === 0 ? `${c.green}0 (PASSED)${c.reset}` : `${c.red}${exitCode} (FAILED)${c.reset}`}`);

    // Persist real evidence to backend
    const git = getGitInfo();
    process.stdout.write(`${c.dim}Recording execution evidence on platform...${c.reset} `);
    const subRes = await this.client.submitEvidence(task.id, {
      command: cmd,
      exitCode,
      stdoutSnippet: stdout.slice(-800),
      stderrSnippet: stderr.slice(-800),
      commitHash: git.latestCommit,
      branch: git.currentBranch,
      changedFiles: git.changedFiles,
    });

    if (subRes.success) {
      console.log(`${c.green}✔ Evidence recorded.${c.reset}`);
      if (subRes.data?.isVerified) {
        console.log(`${c.green}✔ Task meets all criteria and is now marked DONE!${c.reset}`);
      }
    } else {
      console.log(`${c.red}✖ ${subRes.error?.message}${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [6]: Review Check Results ─────────────────────────────
  private async actionReviewCheckResults(task: any) {
    console.log(`\n${c.bold}=== REVIEW CHECK RESULTS & AUDIT EVIDENCE ===${c.reset}`);
    const evRes = await this.client.getTaskEvidence(task.id);
    const evidenceList = evRes.data?.evidence || [];

    if (evidenceList.length === 0) {
      console.log(`\n${c.yellow}No verification checks have been recorded for this task yet.${c.reset}`);
      console.log(`Run action [5] to execute checks and attach genuine execution results.`);
    } else {
      console.log(`\nFound ${evidenceList.length} evidence record(s):\n`);
      evidenceList.forEach((ev: any, idx: number) => {
        const statusBadge = ev.status === 'PASSED'
          ? `${c.green}[PASSED exit 0]${c.reset}`
          : `${c.red}[FAILED exit ${ev.exitCode}]${c.reset}`;
        console.log(`  ${idx + 1}. ${statusBadge} $ ${ev.command} (${new Date(ev.executedAt).toLocaleString()})`);
        if (ev.commitHash) console.log(`     Commit: ${ev.commitHash.slice(0, 8)} | Branch: ${ev.branch || 'main'}`);
        if (ev.stdoutSnippet) console.log(`     Output snippet: ${ev.stdoutSnippet.trim().slice(0, 100)}...`);
      });
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [7]: Add Completion Notes ─────────────────────────────
  private async actionAddCompletionNotes(task: any) {
    console.log(`\n${c.bold}=== ADD COMPLETION NOTES ===${c.reset}`);
    console.log(`Add implementation notes, PR references, or known limitations.`);
    const notes = (await this.prompt(`\nNotes: `)).trim();
    if (!notes) {
      console.log('No notes entered.');
      await this.prompt('Press Enter to return...');
      return;
    }

    const prUrl = (await this.prompt(`Pull Request URL (optional): `)).trim();
    const git = getGitInfo();

    // Attach as evidence note
    const res = await this.client.submitEvidence(task.id, {
      command: 'notes-update',
      exitCode: 0,
      stdoutSnippet: `[Completion Notes]: ${notes}${prUrl ? `\n[PR]: ${prUrl}` : ''}`,
      commitHash: git.latestCommit,
      branch: git.currentBranch,
    });

    if (res.success) {
      console.log(`${c.green}✔ Completion notes saved to task record.${c.reset}`);
    } else {
      console.log(`${c.red}✖ Failed: ${res.error?.message}${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [8]: Attach or Select Evidence ────────────────────────
  private async actionAttachEvidence(task: any) {
    console.log(`\n${c.bold}=== ATTACH OR SELECT EVIDENCE ===${c.reset}`);
    const git = getGitInfo();
    console.log(`Local Git State:`);
    console.log(`  Commit:  ${git.latestCommit || 'None'}`);
    console.log(`  Branch:  ${git.currentBranch || 'main'}`);
    console.log(`  Changed: ${git.changedFiles.length} file(s)`);

    const cmd = (await this.prompt(`\nVerification command associated with this evidence [default: npm test]: `)).trim() || 'npm test';
    const exitCodeStr = (await this.prompt(`Exit code [default: 0]: `)).trim() || '0';
    const exitCode = parseInt(exitCodeStr, 10);
    const summary = (await this.prompt(`Summary of verification: `)).trim();

    process.stdout.write(`${c.dim}Submitting evidence to server...${c.reset} `);
    const res = await this.client.submitEvidence(task.id, {
      command: cmd,
      exitCode: isNaN(exitCode) ? 0 : exitCode,
      stdoutSnippet: summary || 'Verified implementation against acceptance criteria',
      commitHash: git.latestCommit,
      branch: git.currentBranch,
      changedFiles: git.changedFiles,
    });

    if (res.success) {
      console.log(`${c.green}✔ Evidence attached successfully.${c.reset}`);
      if (res.data?.isVerified) {
        console.log(`${c.green}✔ All completion criteria met. Task status is DONE.${c.reset}`);
      }
    } else {
      console.log(`${c.red}✖ Failed: ${res.error?.message}${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [9]: Submit Task for Review ───────────────────────────
  private async actionSubmitForReview(task: any) {
    console.log(`\n${c.bold}=== SUBMIT TASK FOR REVIEW ===${c.reset}`);
    console.log(`This will package your verification records and transition status to ${c.cyan}IN_REVIEW${c.reset}.`);

    const notes = (await this.prompt(`Reviewer notes (optional): `)).trim();
    const prUrl = (await this.prompt(`Pull Request URL (optional): `)).trim();

    const confirm = (await this.prompt(`Confirm submission for review? [Y/n]: `)).trim().toLowerCase();
    if (confirm === 'n') {
      console.log('Submission cancelled.');
      await this.prompt('Press Enter to return...');
      return;
    }

    process.stdout.write(`${c.dim}Submitting to platform...${c.reset} `);
    const res = await this.client.submitTaskForReview(task.id, { notes, prUrl });

    if (res.success) {
      console.log(`${c.green}✔ Task successfully submitted for review!${c.reset}`);
      console.log(`Status is now ${c.cyan}IN_REVIEW${c.reset}. Notifications dispatched to reviewers.`);
    } else {
      console.log(`${c.red}✖ Submission failed: ${res.error?.message}${c.reset}`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [10]: View Review Feedback ────────────────────────────
  private async actionViewReviewFeedback(task: any) {
    console.log(`\n${c.bold}=== REVIEW FEEDBACK & AUDIT TRAIL ===${c.reset}`);
    const actRes = await this.client.getActivity(15);
    const activities = (actRes.data?.activities || []).filter((a: any) => a.taskId === task.id || a.task?.id === task.id);

    if (activities.length === 0) {
      console.log(`\n${c.yellow}No review feedback or activity events recorded for this task yet.${c.reset}`);
    } else {
      console.log(`\nActivity History (${activities.length} event(s)):`);
      activities.forEach((act: any) => {
        const time = new Date(act.createdAt).toLocaleString();
        const user = act.user?.displayName || 'System';
        console.log(`  • [${time}] ${c.cyan}${act.action}${c.reset} by ${user}`);
        if (act.metadata?.notes) console.log(`    Notes: ${act.metadata.notes}`);
      });
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [11]: Verify Completion Eligibility ───────────────────
  private async actionCheckEligibility(task: any) {
    console.log(`\n${c.bold}=== VERIFY TASK COMPLETION ELIGIBILITY ===${c.reset}`);
    process.stdout.write(`${c.dim}Evaluating server-side completion policy...${c.reset}\n`);

    const elRes = await this.client.getTaskEligibility(task.id);
    if (!elRes.success || !elRes.data) {
      console.log(`${c.red}✖ Could not check eligibility: ${elRes.error?.message}${c.reset}`);
      await this.prompt('Press Enter to return...');
      return;
    }

    const { eligible, missingCriteria, hasPassingCheck, latestEvidence, blockers, claim } = elRes.data;

    console.log(`\nEligibility Status: ${eligible ? `${c.green}${c.bold}✔ ELIGIBLE TO COMPLETE${c.reset}` : `${c.red}${c.bold}✖ NOT ELIGIBLE YET${c.reset}`}`);
    console.log(`\nPolicy Requirements:`);

    // 1. Acceptance Criteria
    if (missingCriteria.length === 0) {
      console.log(`  ${c.green}✔ Acceptance Criteria:${c.reset} All criteria satisfied (or not configured)`);
    } else {
      console.log(`  ${c.red}✖ Acceptance Criteria:${c.reset} ${missingCriteria.length} criterion/criteria incomplete:`);
      missingCriteria.forEach((mc: string) => console.log(`     • ${mc}`));
    }

    // 2. Verification check exit code 0
    if (hasPassingCheck) {
      console.log(`  ${c.green}✔ Verification Check:${c.reset} Passing check recorded (Exit Code 0: \`${latestEvidence?.command}\`)`);
    } else {
      console.log(`  ${c.red}✖ Verification Check:${c.reset} No passing check with exit code 0 recorded`);
    }

    // 3. Blockers
    if (blockers.length === 0) {
      console.log(`  ${c.green}✔ Blockers:${c.reset} No active blocking dependencies`);
    } else {
      console.log(`  ${c.red}✖ Blockers:${c.reset} Blocked by incomplete dependencies:`);
      blockers.forEach((b: string) => console.log(`     • ${b}`));
    }

    // 4. Claim Lease
    if (claim.claimedByMe) {
      console.log(`  ${c.green}✔ Claim Lease:${c.reset} Claimed by your active session`);
    } else if (claim.isClaimed) {
      console.log(`  ${c.yellow}⚠ Claim Lease:${c.reset} Claimed by ${claim.claimedByName}`);
    } else {
      console.log(`  ${c.yellow}⚠ Claim Lease:${c.reset} Unclaimed`);
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [12]: Refresh Task Status ─────────────────────────────
  private async actionRefreshStatus(task: any) {
    process.stdout.write(`${c.dim}Refreshing task status from platform...${c.reset} `);
    const res = await this.client.getTask(task.id);
    if (res.success && res.data?.task) {
      console.log(`${c.green}✔ Refreshed! Current status: ${res.data.task.status}${c.reset}`);
    } else {
      console.log(`${c.red}✖ Refresh failed: ${res.error?.message}${c.reset}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  // ─── Numbered Action [13]: Release Task Claim ──────────────────────────────
  private async actionReleaseClaim(task: any) {
    if (!task.claimedById) {
      console.log(`\n${c.yellow}Task is already unclaimed.${c.reset}`);
      await this.prompt('Press Enter to return...');
      return;
    }

    if (task.claimedById !== this.user?.id) {
      console.log(`\n${c.red}Cannot release claim: task is claimed by another user (${task.claimedBy?.displayName || 'team member'}).${c.reset}`);
      await this.prompt('Press Enter to return...');
      return;
    }

    process.stdout.write(`${c.dim}Releasing claim lease...${c.reset} `);
    const res = await this.client.releaseTask(task.id);
    if (res.success) {
      console.log(`${c.green}✔ Claim lease released. Task is now available for other developers.${c.reset}`);
    } else {
      console.log(`${c.red}✖ Failed: ${res.error?.message}${c.reset}`);
    }
    await this.prompt('Press Enter to return...');
  }

  // ─── Numbered Action [14]: Generate AI Implementation Plan ─────────────────
  private async actionGenerateAIPlan(task: any) {
    process.stdout.write(`\n${c.dim}Generating AI Coding Plan for TASK-${task.id}...${c.reset} `);
    const aiRes = await this.client.getCodingPlan(task.id);
    if (aiRes.success && aiRes.data?.codingPlan) {
      const plan = aiRes.data.codingPlan;
      console.log(`\n\n${c.bold}=== AI IMPLEMENTATION PLAN ===${c.reset}`);
      console.log(`${c.cyan}Summary:${c.reset} ${plan.summary}`);
      console.log(`\n${c.bold}Proposed Steps:${c.reset}`);
      plan.steps?.forEach((s: any, i: number) => console.log(`  ${i + 1}. [${s.action}] ${s.description}`));
      console.log(`\n${c.bold}Recommended Validation Commands:${c.reset}`);
      plan.validationCommands?.forEach((cmd: string) => console.log(`  $ ${cmd}`));
    } else {
      console.log(`\n${c.red}✖ Failed: ${aiRes.error?.message || 'Could not generate plan'}${c.reset}`);
    }
    await this.prompt('\nPress Enter to return...');
  }

  // ─── Numbered Action [15]: Help and Keyboard Shortcuts ─────────────────────
  private async actionShowHelp() {
    console.log(`\n${c.bold}=== PROJECT ATLAS — TASK COMPLETION CENTER HELP ===${c.reset}`);
    console.log(`\nYou can enter either a menu number [1-15] or any of these recognized commands:\n`);
    console.log(`  ${c.bold}COMPLETION COMMANDS:${c.reset}`);
    console.log(`    complete, completed, done, finish, finished, mark complete, mark as complete`);
    console.log(`    → Launches the full 10-step guided Task Completion Wizard.\n`);
    console.log(`  ${c.bold}SUBMISSION COMMANDS:${c.reset}`);
    console.log(`    submit, submit task`);
    console.log(`    → Opens evidence attachment and submission workflow.\n`);
    console.log(`  ${c.bold}REVIEW COMMANDS:${c.reset}`);
    console.log(`    submit for review, review, request review`);
    console.log(`    → Submits task to team for code review (transitions to IN_REVIEW).\n`);
    console.log(`  ${c.bold}VERIFICATION COMMANDS:${c.reset}`);
    console.log(`    verify, verification, test, run checks`);
    console.log(`    → Checks server-side completion eligibility and validation policy.\n`);
    console.log(`  ${c.bold}STATUS COMMANDS:${c.reset}`);
    console.log(`    check status, status, refresh`);
    console.log(`    → Refreshes actual task status from the database.\n`);
    console.log(`  ${c.bold}NAVIGATION:${c.reset}`);
    console.log(`    [b] Back to task list    [q] Exit Project Atlas\n`);
    await this.prompt('Press Enter to return...');
  }

  // ─── 5. Task Detail and 10-Step Completion Wizard ──────────────────────────
  private async actionTaskCompletionWizard(task: any) {
    this.drawHeader(`COMPLETION WIZARD: TASK-${task.id.slice(0, 8)}`);

    // STEP 1: Confirm Task Requirements
    console.log(`\n${c.bold}${c.cyan}[Step 1/10] Confirm Task Requirements${c.reset}`);
    console.log(`Canonical ID: TASK-${task.id}`);
    console.log(`Title:        ${task.title}`);
    console.log(`Status:       ${task.status} | Priority: ${task.priority}`);
    console.log(`Project:      ${task.project?.name || 'Default Project'}`);
    console.log(`Assignee:     ${task.assignee?.displayName || task.assignee?.email || 'Unassigned'}`);

    if (!task.claimedById) {
      console.log(`${c.yellow}Notice: Task is not claimed. Claiming now is recommended.${c.reset}`);
      const doClaim = (await this.prompt(`Claim this task now? [Y/n]: `)).trim().toLowerCase();
      if (doClaim !== 'n') {
        await this.client.claimTask(task.id);
        await this.client.updateTaskStatus(task.id, 'IN_PROGRESS');
      }
    } else if (task.claimedById === this.user?.id) {
      console.log(`${c.green}✔ You hold the active claim lease on this task.${c.reset}`);
    }

    // STEP 2: Inspect Acceptance Criteria
    console.log(`\n${c.bold}${c.cyan}[Step 2/10] Inspect Acceptance Criteria${c.reset}`);
    let criteria = (task.acceptanceCriteria as any[]) || [];
    if (criteria.length === 0) {
      console.log(`${c.yellow}Acceptance criteria are not configured.${c.reset}`);
      const addCrit = (await this.prompt('Add a requirement now (or leave empty to proceed): ')).trim();
      if (addCrit) {
        criteria = [{ id: `crit_${Date.now().toString(36)}`, text: addCrit, isCompleted: true }];
        await this.client.updateTaskCriteria(task.id, criteria);
        console.log(`${c.green}✔ Criterion added and marked satisfied.${c.reset}`);
      }
    } else {
      criteria.forEach((crit: any, i: number) => {
        const mark = crit.isCompleted ? `${c.green}[✔]${c.reset}` : `${c.red}[ ]${c.reset}`;
        console.log(`  ${mark} (${i + 1}) ${crit.text}`);
      });
      const uncompleted = criteria.filter((c: any) => !c.isCompleted);
      if (uncompleted.length > 0) {
        console.log(`${c.yellow}Note: ${uncompleted.length} criteria still uncompleted. Tasks require all criteria satisfied to become DONE.${c.reset}`);
        const markAll = (await this.prompt('Mark all criteria satisfied now? [y/N]: ')).trim().toLowerCase();
        if (markAll === 'y') {
          criteria = criteria.map((c: any) => ({ ...c, isCompleted: true }));
          await this.client.updateTaskCriteria(task.id, criteria);
          console.log(`${c.green}✔ All criteria marked satisfied.${c.reset}`);
        }
      }
    }

    // STEP 3: Check Repository and Branch State
    console.log(`\n${c.bold}${c.cyan}[Step 3/10] Check Repository & Git State${c.reset}`);
    const git = getGitInfo();
    if (git.isGitRepo) {
      console.log(`Git Root:   ${git.rootDir}`);
      console.log(`Branch:     ${git.currentBranch} ${task.branchName && task.branchName !== git.currentBranch ? `${c.yellow}(Expected: ${task.branchName})${c.reset}` : ''}`);
      console.log(`Commit:     ${git.latestCommit || 'none'}`);
      console.log(`Changes:    ${git.changedFiles.length} uncommitted file(s)`);
      if (git.changedFiles.length > 0) {
        console.log(`${c.dim}Changed files: ${git.changedFiles.slice(0, 3).join(', ')}${git.changedFiles.length > 3 ? '...' : ''}${c.reset}`);
        console.log(`${c.yellow}Warning: You have uncommitted changes. Please commit before final submission.${c.reset}`);
      }
    } else {
      console.log(`${c.yellow}⚠ Notice: Current directory is not a Git repository.${c.reset}`);
    }

    // STEP 4: Record Implementation Progress
    console.log(`\n${c.bold}${c.cyan}[Step 4/10] Record Implementation Progress${c.reset}`);
    const progressInput = (await this.prompt(`Estimated completion progress % [default: 100]: `)).trim() || '100';
    console.log(`Progress recorded: ${progressInput}%`);

    // STEP 5: Run Configured & Authorized Checks
    console.log(`\n${c.bold}${c.cyan}[Step 5/10] Run Configured Local Validation Checks${c.reset}`);
    const defaultCmd = 'npm test';
    const cmd = (await this.prompt(`Validation check command [default: "${defaultCmd}"]: `)).trim() || defaultCmd;

    console.log(`\n${c.cyan}Executing: $ ${cmd}${c.reset}\n`);
    const { execSync } = await import('child_process');

    let exitCode = 0;
    let stdoutSnippet = '';
    let stderrSnippet = '';
    const startTime = Date.now();

    try {
      const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
      stdoutSnippet = stdout.slice(-800);
      process.stdout.write(stdout);
    } catch (err: any) {
      exitCode = err.status || 1;
      stdoutSnippet = err.stdout?.slice(-800) || '';
      stderrSnippet = err.stderr?.slice(-800) || err.message;
      if (stdoutSnippet) process.stdout.write(stdoutSnippet);
      if (stderrSnippet) process.stderr.write(stderrSnippet);
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // STEP 6: Review Actual Execution Results
    console.log(`\n${c.bold}${c.cyan}[Step 6/10] Review Execution Results${c.reset}`);
    console.log(`Duration:  ${duration}s`);
    console.log(`Exit Code: ${exitCode === 0 ? `${c.green}0 (PASSED)${c.reset}` : `${c.red}${exitCode} (FAILED)${c.reset}`}`);
    if (exitCode !== 0) {
      console.log(`${c.red}⚠ Warning: Non-zero exit code indicates test/build failure.${c.reset}`);
      const proceedFail = (await this.prompt(`Proceed with submitting failed check evidence? [y/N]: `)).trim().toLowerCase();
      if (proceedFail !== 'y') {
        console.log(`Submission aborted. Fix issues and re-run wizard.`);
        await this.prompt('Press Enter to return...');
        return;
      }
    }

    // STEP 7: Add Completion Notes
    console.log(`\n${c.bold}${c.cyan}[Step 7/10] Add Completion Notes & PR References${c.reset}`);
    const notes = (await this.prompt(`Optional notes (e.g. PR URL, summary): `)).trim();

    // STEP 8: Submit Genuine Evidence Payload
    console.log(`\n${c.bold}${c.cyan}[Step 8/10] Submitting Evidence to Server...${c.reset}`);
    process.stdout.write(`${c.dim}Packaging evidence payload...${c.reset} `);

    let submitRes: any;
    try {
      submitRes = await this.client.submitEvidence(task.id, {
        command: cmd,
        exitCode,
        stdoutSnippet: stdoutSnippet + (notes ? `\n[Notes]: ${notes}` : ''),
        stderrSnippet,
        commitHash: git.latestCommit,
        branch: git.currentBranch,
        changedFiles: git.changedFiles,
      });
    } catch (netErr: any) {
      console.log(`\n${c.red}✖ Network Error: ${netErr.message}${c.reset}`);
      console.log(`${c.yellow}Local evidence preserved. The server has NOT confirmed this submission.${c.reset}`);
      await this.prompt('\nPress Enter to return...');
      return;
    }

    // STEP 9: Review Status Decision
    console.log(`\n${c.bold}${c.cyan}[Step 9/10] Evaluating Server-Side Completion Policy${c.reset}`);
    if (submitRes.success) {
      console.log(`Server response received: Status=${submitRes.data?.status}, Verified=${submitRes.data?.isVerified}`);
    } else {
      console.log(`${c.red}✖ Server policy rejected completion: ${submitRes.error?.message}${c.reset}`);
    }

    // STEP 10: Show Server-Confirmed Result
    console.log(`\n${c.bold}${c.cyan}[Step 10/10] Server-Confirmed Decision${c.reset}`);
    if (submitRes.success) {
      if (submitRes.data?.isVerified) {
        console.log(`${c.bold}${c.green}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.bold}${c.green}║  ✔ TASK OFFICIALLY VERIFIED & COMPLETED (STATUS: DONE)                 ║${c.reset}`);
        console.log(`${c.bold}${c.green}║  Evidence persisted in PostgreSQL with exit code 0 and criteria match. ║${c.reset}`);
        console.log(`${c.bold}${c.green}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
      } else {
        console.log(`${c.yellow}Task remains in status [${submitRes.data?.status}]. Completion requirements missing:${c.reset}`);
        if (submitRes.data?.missingCriteria?.length > 0) {
          submitRes.data.missingCriteria.forEach((mc: string) => console.log(`  • Unsatisfied criterion: ${mc}`));
        }
        if (exitCode !== 0) {
          console.log(`  • Non-zero exit code: ${exitCode}`);
        }
      }
    }

    await this.prompt('\nPress Enter to return to task details...');
  }

  // ─── 6. Repositories Screen ────────────────────────────────────────────────
  private async screenRepositories() {
    this.drawHeader('REPOSITORY & GIT DIAGNOSTICS');
    const git = getGitInfo();
    const reposRes = await this.client.listRepositories(this.activeWorkspaceId || undefined);
    const repos = reposRes.data?.repositories || [];

    console.log(`│  ${c.bold}Local Directory:${c.reset} ${process.cwd().padEnd(51)}│`);
    console.log(`│  ${c.bold}Git Root:${c.reset}        ${(git.rootDir || 'None detected').padEnd(51)}│`);
    console.log(`│  ${c.bold}Current Branch:${c.reset}  ${(git.currentBranch || 'None').padEnd(51)}│`);
    console.log(`│  ${c.bold}Latest Commit:${c.reset}   ${(git.latestCommit || 'None').padEnd(51)}│`);
    console.log(`│  ${c.bold}Remote URL:${c.reset}      ${(git.remoteUrl || 'No remote configured').padEnd(51)}│`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.bold}REGISTERED WORKSPACE REPOSITORIES:${c.reset}                                    │`);

    repos.slice(0, 5).forEach((r: any) => {
      console.log(`│  • ${c.cyan}${r.name.padEnd(24)}${c.reset} branch: ${r.defaultBranch.padEnd(10)} ${(r.localPath || '').slice(0, 26).padEnd(26)}│`);
    });

    if (repos.length === 0) {
      console.log(`│  (No repositories registered in this workspace)                        │`);
    }

    console.log(`│                                                                        │`);
    console.log(`│  ${c.cyan}[1]${c.reset} Connect Current Git Repository to Workspace                      │`);
    console.log(`│  ${c.cyan}[b]${c.reset} Back to Dashboard                                                │`);
    console.log(`│                                                                        │`);
    this.drawFooter();

    const choice = (await this.prompt(`\n${c.bold}Option [1, b]: ${c.reset}`)).trim().toLowerCase();
    if (choice === '1') {
      const defaultName = (process.cwd().split(/[/\\]/).pop() || 'repo').trim();
      const repoName = (await this.prompt(`Repository name [default: "${defaultName}"]: `)).trim() || defaultName;

      process.stdout.write(`Connecting repository... `);
      const res = await this.client.connectRepository({
        repoName,
        gitRemoteUrl: git.remoteUrl || undefined,
        currentBranch: git.currentBranch || 'main',
        localPath: process.cwd(),
        workspaceId: this.activeWorkspaceId || undefined,
      });

      if (res.success) {
        console.log(`${c.green}✔ Connected!${c.reset}`);
      } else {
        console.log(`${c.red}✖ ${res.error?.message || 'Failed'}${c.reset}`);
      }
      await this.prompt('Press Enter to continue...');
    } else {
      this.currentScreen = 'DASHBOARD';
    }
  }

  // ─── 7. Checks Screen ──────────────────────────────────────────────────────
  private async screenChecks() {
    this.drawHeader('EXECUTE LOCAL CHECKS');
    console.log(`│  Run configured test suites or linting locally and verify results:     │`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.cyan}[1]${c.reset} Run npm test                                                      │`);
    console.log(`│  ${c.cyan}[2]${c.reset} Run npm run typecheck                                            │`);
    console.log(`│  ${c.cyan}[3]${c.reset} Run Custom Validation Command                                    │`);
    console.log(`│  ${c.cyan}[b]${c.reset} Back to Dashboard                                                │`);
    console.log(`│                                                                        │`);
    this.drawFooter();

    const choice = (await this.prompt(`\n${c.bold}Option [1-3, b]: ${c.reset}`)).trim().toLowerCase();
    if (choice === 'b') {
      this.currentScreen = 'DASHBOARD';
      return;
    }

    let cmd = 'npm test';
    if (choice === '2') cmd = 'npm run typecheck';
    else if (choice === '3') {
      cmd = (await this.prompt('Enter shell command: ')).trim();
    }

    if (cmd) {
      console.log(`\n${c.cyan}Executing: $ ${cmd}${c.reset}\n`);
      const { execSync } = await import('child_process');
      try {
        const out = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
        process.stdout.write(out);
        console.log(`\n${c.green}✔ Check PASSED (Exit Code: 0)${c.reset}`);
      } catch (err: any) {
        if (err.stdout) process.stdout.write(err.stdout);
        if (err.stderr) process.stderr.write(err.stderr);
        console.log(`\n${c.red}✖ Check FAILED with exit code: ${err.status || 1}${c.reset}`);
      }
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── 8. AI Developer Assistant Screen ──────────────────────────────────────
  private async screenAI() {
    this.drawHeader('AI DEVELOPER ASSISTANT');
    console.log(`│  Authorized workspace-grounded AI coding operations:                   │`);
    console.log(`│                                                                        │`);
    console.log(`│  ${c.cyan}[1]${c.reset} Generate Implementation Plan for Task                            │`);
    console.log(`│  ${c.cyan}[2]${c.reset} Draft Pull Request from Evidence & Commits                       │`);
    console.log(`│  ${c.cyan}[3]${c.reset} Generate Developer Handoff Summary                               │`);
    console.log(`│  ${c.cyan}[b]${c.reset} Back to Dashboard                                                │`);
    console.log(`│                                                                        │`);
    this.drawFooter();

    const choice = (await this.prompt(`\n${c.bold}Option [1-3, b]: ${c.reset}`)).trim().toLowerCase();
    if (choice === 'b') {
      this.currentScreen = 'DASHBOARD';
      return;
    }

    const taskId = (await this.prompt('Enter Task ID (e.g. TASK-xxx): ')).trim();
    if (!taskId) return;

    if (choice === '1') {
      process.stdout.write(`${c.dim}Generating plan...${c.reset} `);
      const res = await this.client.getCodingPlan(taskId);
      if (res.success && res.data?.codingPlan) {
        console.log(`\n\n${c.bold}=== AI IMPLEMENTATION PLAN ===${c.reset}`);
        console.log(JSON.stringify(res.data.codingPlan, null, 2));
      } else {
        console.log(`\n${c.red}✖ ${res.error?.message || 'Failed'}${c.reset}`);
      }
    } else if (choice === '2') {
      process.stdout.write(`${c.dim}Drafting Pull Request...${c.reset} `);
      const res = await this.client.getPullRequestDraft(taskId);
      if (res.success && res.data?.pullRequestDraft) {
        console.log(`\n\n${c.bold}=== PULL REQUEST DRAFT ===${c.reset}`);
        console.log(res.data.pullRequestDraft.markdownBody || JSON.stringify(res.data.pullRequestDraft, null, 2));
      } else {
        console.log(`\n${c.red}✖ ${res.error?.message || 'Failed'}${c.reset}`);
      }
    } else if (choice === '3') {
      process.stdout.write(`${c.dim}Generating Handoff Summary...${c.reset} `);
      const res = await this.client.getHandoffSummary(taskId);
      if (res.success && res.data?.handoffSummary) {
        console.log(`\n\n${c.bold}=== DEVELOPER HANDOFF SUMMARY ===${c.reset}`);
        console.log(JSON.stringify(res.data.handoffSummary, null, 2));
      } else {
        console.log(`\n${c.red}✖ ${res.error?.message || 'Failed'}${c.reset}`);
      }
    }

    await this.prompt('\nPress Enter to return...');
  }

  // ─── Helper: Switch Workspace ──────────────────────────────────────────────
  private async actionSwitchWorkspace() {
    if (this.workspaces.length === 0) {
      console.log(`\nNo additional workspaces found.`);
      await this.prompt('Press Enter to continue...');
      return;
    }

    console.log(`\n${c.bold}Available Workspaces:${c.reset}`);
    this.workspaces.forEach((w: any, idx: number) => {
      const activeMarker = w.id === this.activeWorkspaceId ? `${c.green}[ACTIVE]${c.reset}` : '';
      console.log(`  ${idx + 1}. ${w.name} (${w.slug}) ${activeMarker}`);
    });

    const choice = parseInt(await this.prompt('\nSelect workspace number: '), 10);
    if (!isNaN(choice) && choice >= 1 && choice <= this.workspaces.length) {
      this.activeWorkspaceId = this.workspaces[choice - 1].id;
      saveGlobalConfig({ workspaceId: this.activeWorkspaceId || undefined });
      console.log(`${c.green}✔ Switched workspace to "${this.workspaces[choice - 1].name}"${c.reset}`);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}
