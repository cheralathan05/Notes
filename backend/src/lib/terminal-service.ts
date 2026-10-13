import { prisma } from './prisma';
import { tasksService } from './tasks-service';
import { projectsService } from './projects-service';
import { TaskStatus, TaskPriority } from '@prisma/client';

export interface TerminalExecutionResult {
  success: boolean;
  command: string;
  output: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface AutocompleteSuggestion {
  text: string;
  description: string;
  category: 'command' | 'subcommand' | 'task' | 'project' | 'flag';
}

export class TerminalService {
  /**
   * Split a command string safely into tokens, preserving quoted arguments
   */
  private tokenize(commandStr: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];

      if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
        inQuotes = !inQuotes;
        quoteChar = inQuotes ? char : '';
      } else if (char === ' ' && !inQuotes) {
        if (current.trim().length > 0) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim().length > 0) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Parse flags from token list (e.g. --today, --priority=HIGH, --project 123)
   */
  private extractFlags(tokens: string[]): { args: string[]; flags: Record<string, string | boolean> } {
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith('--')) {
        const flagName = token.slice(2);
        if (flagName.includes('=')) {
          const [key, val] = flagName.split('=');
          flags[key.toLowerCase()] = val;
        } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
          flags[flagName.toLowerCase()] = tokens[i + 1];
          i++; // skip next token
        } else {
          flags[flagName.toLowerCase()] = true;
        }
      } else if (token.startsWith('-') && token.length > 1) {
        flags[token.slice(1).toLowerCase()] = true;
      } else {
        args.push(token);
      }
    }

    return { args, flags };
  }

  /**
   * Resolve task by full ID or partial prefix (e.g. TASK-102 or prefix of UUID)
   */
  private async resolveTask(workspaceId: string, identifier: string) {
    if (!identifier) return null;
    const cleanId = identifier.trim().replace(/^TASK-/i, '');

    // Try exact UUID
    let task = await prisma.task.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: cleanId },
          { id: identifier },
          { id: { startsWith: cleanId } },
          { title: { contains: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        subtasks: { select: { id: true, title: true, status: true } },
        checklists: { select: { id: true, title: true, isCompleted: true } },
        blocking: { include: { blockedTask: { select: { id: true, title: true, status: true } } } },
        blockedBy: { include: { blockingTask: { select: { id: true, title: true, status: true } } } },
      },
    });

    return task as any;
  }

  /**
   * Resolve project by ID or name
   */
  private async resolveProject(workspaceId: string, identifier: string) {
    if (!identifier) return null;
    const cleanId = identifier.trim().replace(/^PROJECT-/i, '');

    const project = await prisma.project.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: cleanId },
          { id: identifier },
          { name: { contains: cleanId, mode: 'insensitive' } },
        ],
      },
      include: {
        tasks: { select: { id: true, title: true, status: true, priority: true } },
        milestones: true,
      },
    });

    return project;
  }

  /**
   * Execute command in workspace context
   */
  async execute(workspaceId: string, userId: string, rawInput: string): Promise<TerminalExecutionResult> {
    const trimmed = rawInput.trim();
    const timestamp = new Date().toISOString();

    if (!trimmed) {
      return {
        success: true,
        command: '',
        output: '',
        timestamp,
      };
    }

    const rawTokens = this.tokenize(trimmed);
    const { args, flags } = this.extractFlags(rawTokens);

    const rootCommand = (args[0] || '').toLowerCase();
    const subCommand = (args[1] || '').toLowerCase();

    // ─── Help Command ────────────────────────────────────────────────────────
    if (rootCommand === 'help') {
      const topic = (args[1] || '').toLowerCase();
      if (topic === 'task') {
        return {
          success: true,
          command: trimmed,
          output: [
            'TASK COMMANDS:',
            '  task list [--today] [--overdue] [--mine]   List tasks with optional filters',
            '  task search <query>                         Search tasks by title/desc',
            '  task create "<title>" [--priority <P>]     Create a task (P: URGENT|HIGH|MEDIUM|LOW)',
            '  task show <ID>                              Show task details, subtasks & blockers',
            '  task complete <ID>                          Mark task status as DONE (Alias: tc <ID>)',
            '  task reopen <ID>                            Reopen completed task to TODO',
            '  task status <ID> <STATUS>                   Change status (BACKLOG|TODO|IN_PROGRESS|IN_REVIEW|DONE)',
            '  task priority <ID> <PRIORITY>               Set priority (URGENT|HIGH|MEDIUM|LOW|NONE)',
            '  task assign <ID> <email|userId>             Assign task to workspace member',
            '  task due <ID> <YYYY-MM-DD>                  Set task due date',
            '  task subtask <ID> "<title>"                 Add subtask',
            '  task comment <ID> "<text>"                  Add comment to task',
            '  task block <ID> by <blockingID>             Add Finish-to-Start dependency',
            '  task dependencies <ID>                      Inspect blockers and dependents',
            '  task delete <ID>                            Delete a task',
          ].join('\n'),
          timestamp,
        };
      }

      if (topic === 'project') {
        return {
          success: true,
          command: trimmed,
          output: [
            'PROJECT COMMANDS:',
            '  project list                                List workspace projects & health',
            '  project create "<name>" [--description <D>] Create a project',
            '  project show <ID>                           Show project details & milestones',
            '  project progress <ID>                       Show recalculated completion %',
            '  project tasks <ID>                          List all tasks in project',
          ].join('\n'),
          timestamp,
        };
      }

      return {
        success: true,
        command: trimmed,
        output: [
          'KRONOS WORKSPACE CLI - COMMAND CENTER',
          '======================================',
          'Available Command Groups:',
          '  task <subcommand>     Manage tasks, assignees, subtasks, dependencies',
          '  project <subcommand>  Manage projects, milestones, progress',
          '  clear                 Clear terminal window output',
          '  help [task|project]   Display detailed help for command group',
          '',
          'Aliases: tc <ID> (task complete) | tl (task list) | pl (project list)',
          'Type "help task" or "help project" for detailed syntax.',
        ].join('\n'),
        timestamp,
      };
    }

    if (rootCommand === 'clear') {
      return {
        success: true,
        command: trimmed,
        output: '__CLEAR__',
        timestamp,
      };
    }

    // ─── Aliases ─────────────────────────────────────────────────────────────
    if (rootCommand === 'tc' && args[1]) {
      return this.execute(workspaceId, userId, `task complete ${args[1]}`);
    }
    if (rootCommand === 'tl' || rootCommand === 'tlist') {
      return this.execute(workspaceId, userId, 'task list');
    }
    if (rootCommand === 'pl' || rootCommand === 'plist') {
      return this.execute(workspaceId, userId, 'project list');
    }

    // ─── Task Command Group ──────────────────────────────────────────────────
    if (rootCommand === 'task') {
      // 1. task list
      if (subCommand === 'list' || !subCommand) {
        const filterOpts: any = {
          parentOnly: true,
        };

        if (flags.today) filterOpts.dueFilter = 'today';
        if (flags.overdue) filterOpts.dueFilter = 'overdue';
        if (flags.mine) filterOpts.assigneeId = userId;
        if (flags.status) filterOpts.status = String(flags.status).toUpperCase() as TaskStatus;

        const tasks = await tasksService.listTasks(workspaceId, filterOpts);

        if (tasks.length === 0) {
          return {
            success: true,
            command: trimmed,
            output: 'No tasks found matching criteria.',
            data: { count: 0, tasks: [] },
            timestamp,
          };
        }

        const lines = tasks.map((t: any) => {
          const statusIcon =
            t.status === 'DONE'
              ? '✓'
              : t.status === 'IN_PROGRESS'
              ? '→'
              : t.status === 'IN_REVIEW'
              ? '👁'
              : t.status === 'CANCELLED'
              ? '✕'
              : '○';
          const priorityTag = `[${t.priority}]`.padEnd(9);
          const blockerTag = t.isBlocked ? ' ⛔ BLOCKED' : '';
          const shortId = t.id.slice(0, 8);
          return `${statusIcon} ${shortId} | ${priorityTag} | ${t.title}${blockerTag}`;
        });

        return {
          success: true,
          command: trimmed,
          output: [`Found ${tasks.length} task(s):`, ...lines].join('\n'),
          data: { count: tasks.length, tasks },
          timestamp,
        };
      }

      // 2. task search <query>
      if (subCommand === 'search') {
        const query = args.slice(2).join(' ');
        if (!query) {
          return {
            success: false,
            command: trimmed,
            output: 'Usage: task search "<query>"',
            timestamp,
          };
        }

        const tasks = await tasksService.listTasks(workspaceId, { search: query });
        const lines = tasks.map((t: any) => {
          const icon = t.status === 'DONE' ? '✓' : '○';
          return `${icon} ${t.id.slice(0, 8)} | ${t.title} (${t.status})`;
        });

        return {
          success: true,
          command: trimmed,
          output: lines.length > 0 ? [`Results for "${query}":`, ...lines].join('\n') : `No tasks matching "${query}".`,
          data: { tasks },
          timestamp,
        };
      }

      // 3. task create "<title>"
      if (subCommand === 'create') {
        const title = args.slice(2).join(' ');
        if (!title) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Task title is required. Example: task create "Write unit tests" --priority HIGH',
            timestamp,
          };
        }

        let priority: TaskPriority = 'MEDIUM';
        if (flags.priority) {
          const p = String(flags.priority).toUpperCase() as TaskPriority;
          if (['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(p)) {
            priority = p;
          }
        }

        let dueDate: Date | undefined;
        if (flags.due) {
          dueDate = new Date(String(flags.due));
        }

        let projectId: string | undefined;
        if (flags.project) {
          const proj = await this.resolveProject(workspaceId, String(flags.project));
          if (proj) projectId = proj.id;
        }

        const task = await tasksService.createTask(userId, workspaceId, {
          title,
          priority,
          dueDate,
          projectId,
        });

        return {
          success: true,
          command: trimmed,
          output: [
            '✓ Task created successfully',
            `  ID:       ${task.id.slice(0, 8)} (${task.id})`,
            `  Title:    ${task.title}`,
            `  Status:   ${task.status}`,
            `  Priority: ${task.priority}`,
            dueDate ? `  Due Date: ${dueDate.toLocaleDateString()}` : '',
            projectId ? `  Project:  ${projectId}` : '',
          ].filter(Boolean).join('\n'),
          data: { task },
          timestamp,
        };
      }

      // 4. task show <id>
      if (subCommand === 'show') {
        const identifier = args[2];
        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found in workspace.`,
            timestamp,
          };
        }

        const lines = [
          `Task: ${task.title}`,
          `  ID:          ${task.id}`,
          `  Status:      ${task.status}`,
          `  Priority:    ${task.priority}`,
          `  Project:     ${task.project ? task.project.name : 'None'}`,
          `  Assignee:    ${task.assignee ? task.assignee.displayName || task.assignee.email : 'Unassigned'}`,
          `  Due Date:    ${task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'None'}`,
          `  Subtasks:    ${task.subtasks.length}`,
          `  Checklist:   ${task.checklists.filter((c: any) => c.isCompleted).length}/${task.checklists.length}`,
          `  Blockers:    ${task.blockedBy.length > 0 ? task.blockedBy.map((b: any) => b.blockingTask.title).join(', ') : 'None'}`,
        ];

        return {
          success: true,
          command: trimmed,
          output: lines.join('\n'),
          data: { task },
          timestamp,
        };
      }

      // 5. task complete <id>
      if (subCommand === 'complete') {
        const identifier = args[2];
        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const updated = await tasksService.updateTask(task.id, workspaceId, userId, {
          status: 'DONE',
        });

        return {
          success: true,
          command: trimmed,
          output: [
            '✓ Task completed successfully',
            `  ID:     ${updated.id.slice(0, 8)}`,
            `  Title:  ${updated.title}`,
            `  Status: ${task.status} → DONE`,
            updated.projectId ? '  Project progress recalculated.' : '',
          ].filter(Boolean).join('\n'),
          data: { task: updated },
          timestamp,
        };
      }

      // 6. task reopen <id>
      if (subCommand === 'reopen') {
        const identifier = args[2];
        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const updated = await tasksService.updateTask(task.id, workspaceId, userId, {
          status: 'TODO',
        });

        return {
          success: true,
          command: trimmed,
          output: [
            '✓ Task reopened successfully',
            `  ID:     ${updated.id.slice(0, 8)}`,
            `  Status: ${task.status} → TODO`,
          ].join('\n'),
          data: { task: updated },
          timestamp,
        };
      }

      // 7. task status <id> <status>
      if (subCommand === 'status') {
        const identifier = args[2];
        const newStatus = (args[3] || '').toUpperCase() as TaskStatus;
        if (!['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'].includes(newStatus)) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Valid statuses are: BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED',
            timestamp,
          };
        }

        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const updated = await tasksService.updateTask(task.id, workspaceId, userId, {
          status: newStatus,
        });

        return {
          success: true,
          command: trimmed,
          output: `✓ Task ${updated.id.slice(0, 8)} status updated to ${newStatus}`,
          data: { task: updated },
          timestamp,
        };
      }

      // 8. task priority <id> <priority>
      if (subCommand === 'priority') {
        const identifier = args[2];
        const newPriority = (args[3] || '').toUpperCase() as TaskPriority;
        if (!['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(newPriority)) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Valid priorities are: URGENT, HIGH, MEDIUM, LOW, NONE',
            timestamp,
          };
        }

        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const updated = await tasksService.updateTask(task.id, workspaceId, userId, {
          priority: newPriority,
        });

        return {
          success: true,
          command: trimmed,
          output: `✓ Task ${updated.id.slice(0, 8)} priority updated to ${newPriority}`,
          data: { task: updated },
          timestamp,
        };
      }

      // 9. task due <id> <YYYY-MM-DD>
      if (subCommand === 'due') {
        const identifier = args[2];
        const dateStr = args[3];
        const dueDate = new Date(dateStr);
        if (isNaN(dueDate.getTime())) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Invalid date format. Use YYYY-MM-DD (e.g. 2026-10-25)',
            timestamp,
          };
        }

        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const updated = await tasksService.updateTask(task.id, workspaceId, userId, {
          dueDate,
        });

        return {
          success: true,
          command: trimmed,
          output: `✓ Task ${updated.id.slice(0, 8)} deadline set to ${dueDate.toISOString().split('T')[0]}`,
          data: { task: updated },
          timestamp,
        };
      }

      // 10. task subtask <id> "<title>"
      if (subCommand === 'subtask') {
        const identifier = args[2];
        const title = args.slice(3).join(' ');
        if (!title) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Subtask title is required. Usage: task subtask <ID> "<title>"',
            timestamp,
          };
        }

        const parentTask = await this.resolveTask(workspaceId, identifier);
        if (!parentTask) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Parent task "${identifier}" not found.`,
            timestamp,
          };
        }

        const subtask = await tasksService.createTask(userId, workspaceId, {
          title,
          parentId: parentTask.id,
          projectId: parentTask.projectId || undefined,
        });

        return {
          success: true,
          command: trimmed,
          output: [
            '✓ Subtask added successfully',
            `  Subtask ID: ${subtask.id.slice(0, 8)}`,
            `  Title:      ${subtask.title}`,
            `  Parent ID:  ${parentTask.id.slice(0, 8)}`,
          ].join('\n'),
          data: { subtask },
          timestamp,
        };
      }

      // 11. task comment <id> "<comment>"
      if (subCommand === 'comment') {
        const identifier = args[2];
        const content = args.slice(3).join(' ');
        if (!content) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Comment text is required. Usage: task comment <ID> "<text>"',
            timestamp,
          };
        }

        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const comment = await tasksService.addComment(task.id, userId, content);

        return {
          success: true,
          command: trimmed,
          output: `✓ Comment added to task ${task.id.slice(0, 8)}`,
          data: { comment },
          timestamp,
        };
      }

      // 12. task block <blockedId> by <blockingId>
      if (subCommand === 'block') {
        // syntax: task block <ID1> by <ID2>
        const blockedIdStr = args[2];
        const byKeywordIndex = args.indexOf('by');
        const blockingIdStr = byKeywordIndex !== -1 ? args[byKeywordIndex + 1] : args[3];

        if (!blockedIdStr || !blockingIdStr) {
          return {
            success: false,
            command: trimmed,
            output: 'Usage: task block <BLOCKED_ID> by <BLOCKING_ID>',
            timestamp,
          };
        }

        const blockedTask = await this.resolveTask(workspaceId, blockedIdStr);
        const blockingTask = await this.resolveTask(workspaceId, blockingIdStr);

        if (!blockedTask || !blockingTask) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: One or both tasks could not be found.',
            timestamp,
          };
        }

        try {
          const dep = await tasksService.addDependency(blockingTask.id, blockedTask.id);
          return {
            success: true,
            command: trimmed,
            output: [
              '✓ Dependency recorded (Finish-to-Start):',
              `  [${blockedTask.title}] is now blocked by [${blockingTask.title}]`,
              '  Status verified: DAG circular dependency cycle check passed.',
            ].join('\n'),
            data: { dependency: dep },
            timestamp,
          };
        } catch (err: any) {
          return {
            success: false,
            command: trimmed,
            output: `Dependency Error: ${err.message}`,
            error: err.message,
            timestamp,
          };
        }
      }

      // 13. task dependencies <id>
      if (subCommand === 'dependencies') {
        const identifier = args[2];
        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        const blockedBy = (task.blockedBy || []).map((b: any) => `  ← Blocked by: [${b.blockingTask.status}] ${b.blockingTask.title} (${b.blockingTask.id.slice(0, 8)})`);
        const blocking = (task.blocking || []).map((d: any) => `  → Blocking:   [${d.blockedTask.status}] ${d.blockedTask.title} (${d.blockedTask.id.slice(0, 8)})`);

        const output = [
          `Dependency graph for "${task.title}":`,
          blockedBy.length > 0 ? blockedBy.join('\n') : '  No incoming blockers.',
          blocking.length > 0 ? blocking.join('\n') : '  No downstream dependent tasks.',
        ].join('\n');

        return {
          success: true,
          command: trimmed,
          output,
          data: { task },
          timestamp,
        };
      }

      // 14. task delete <id>
      if (subCommand === 'delete') {
        const identifier = args[2];
        const task = await this.resolveTask(workspaceId, identifier);
        if (!task) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Task "${identifier}" not found.`,
            timestamp,
          };
        }

        await tasksService.deleteTask(task.id, userId, workspaceId);
        return {
          success: true,
          command: trimmed,
          output: `✓ Task ${task.id.slice(0, 8)} ("${task.title}") deleted from workspace.`,
          timestamp,
        };
      }
    }

    // ─── Project Command Group ───────────────────────────────────────────────
    if (rootCommand === 'project') {
      // 1. project list
      if (subCommand === 'list' || !subCommand) {
        const projects = await projectsService.listProjects(workspaceId);
        if (projects.length === 0) {
          return {
            success: true,
            command: trimmed,
            output: 'No projects in workspace. Use: project create "<name>"',
            timestamp,
          };
        }

        const lines = projects.map((p: any) => {
          const healthIcon = p.health === 'ON_TRACK' ? '●' : p.health === 'AT_RISK' ? '▲' : '✖';
          return `${healthIcon} ${p.id.slice(0, 8)} | ${p.name.padEnd(24)} | ${p.progress}% done | Health: ${p.health} (${p._count?.tasks || 0} tasks)`;
        });

        return {
          success: true,
          command: trimmed,
          output: [`Workspace Projects (${projects.length}):`, ...lines].join('\n'),
          data: { projects },
          timestamp,
        };
      }

      // 2. project create "<name>"
      if (subCommand === 'create') {
        const name = args.slice(2).join(' ');
        if (!name) {
          return {
            success: false,
            command: trimmed,
            output: 'Error: Project name is required. Usage: project create "<name>"',
            timestamp,
          };
        }

        const description = typeof flags.description === 'string' ? flags.description : undefined;
        const project = await projectsService.createProject(userId, workspaceId, {
          name,
          description,
        });

        return {
          success: true,
          command: trimmed,
          output: [
            '✓ Project created successfully',
            `  ID:     ${project.id.slice(0, 8)} (${project.id})`,
            `  Name:   ${project.name}`,
            `  Status: ${project.status}`,
          ].join('\n'),
          data: { project },
          timestamp,
        };
      }

      // 3. project show <id>
      if (subCommand === 'show') {
        const identifier = args[2];
        const project = await this.resolveProject(workspaceId, identifier);
        if (!project) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Project "${identifier}" not found.`,
            timestamp,
          };
        }

        return {
          success: true,
          command: trimmed,
          output: [
            `Project: ${project.name}`,
            `  ID:         ${project.id}`,
            `  Status:     ${project.status}`,
            `  Health:     ${project.health}`,
            `  Progress:   ${project.progress}%`,
            `  Tasks:      ${project.tasks.length}`,
            `  Milestones: ${project.milestones.length}`,
          ].join('\n'),
          data: { project },
          timestamp,
        };
      }

      // 4. project progress <id>
      if (subCommand === 'progress') {
        const identifier = args[2];
        const project = await this.resolveProject(workspaceId, identifier);
        if (!project) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Project "${identifier}" not found.`,
            timestamp,
          };
        }

        const metrics = await projectsService.recalculateProjectProgress(project.id);
        return {
          success: true,
          command: trimmed,
          output: [
            `Project Health & Progress [${project.name}]:`,
            `  Progress: ${metrics.progress}%`,
            `  Health:   ${metrics.health}`,
            `  Formula:  Authoritative calculation based on non-cancelled root tasks.`,
          ].join('\n'),
          data: metrics,
          timestamp,
        };
      }

      // 5. project tasks <id>
      if (subCommand === 'tasks') {
        const identifier = args[2];
        const project = await this.resolveProject(workspaceId, identifier);
        if (!project) {
          return {
            success: false,
            command: trimmed,
            output: `Error: Project "${identifier}" not found.`,
            timestamp,
          };
        }

        const tasks = await tasksService.listTasks(workspaceId, { projectId: project.id });
        const lines = tasks.map((t: any) => `  ${t.status === 'DONE' ? '✓' : '○'} ${t.id.slice(0, 8)} | ${t.title}`);

        return {
          success: true,
          command: trimmed,
          output: [
            `Tasks in "${project.name}" (${tasks.length}):`,
            ...lines,
          ].join('\n'),
          data: { tasks },
          timestamp,
        };
      }
    }

    // Unknown command
    return {
      success: false,
      command: trimmed,
      output: `Unknown command: "${rawTokens[0]}". Type "help" to see available commands.`,
      timestamp,
    };
  }

  /**
   * Provide suggestions for autocomplete based on input prefix
   */
  async getSuggestions(workspaceId: string, partialInput: string): Promise<AutocompleteSuggestion[]> {
    const trimmed = partialInput.trimStart();
    const suggestions: AutocompleteSuggestion[] = [];

    const baseCommands = [
      { text: 'task list', description: 'List workspace tasks', category: 'command' as const },
      { text: 'task create', description: 'Create a new task', category: 'command' as const },
      { text: 'task complete', description: 'Complete a task by ID', category: 'command' as const },
      { text: 'task reopen', description: 'Reopen completed task', category: 'command' as const },
      { text: 'task show', description: 'Show task details and blockers', category: 'command' as const },
      { text: 'task status', description: 'Change workflow status', category: 'command' as const },
      { text: 'task priority', description: 'Change task priority', category: 'command' as const },
      { text: 'task block', description: 'Add Finish-to-Start dependency', category: 'command' as const },
      { text: 'task subtask', description: 'Create subtask under parent', category: 'command' as const },
      { text: 'task comment', description: 'Add comment to task', category: 'command' as const },
      { text: 'project list', description: 'List workspace projects', category: 'command' as const },
      { text: 'project create', description: 'Create a new project', category: 'command' as const },
      { text: 'project progress', description: 'Recalculate project progress', category: 'command' as const },
      { text: 'help task', description: 'View help on task commands', category: 'command' as const },
      { text: 'help project', description: 'View help on project commands', category: 'command' as const },
      { text: 'clear', description: 'Clear terminal screen', category: 'command' as const },
    ];

    if (!trimmed) {
      return baseCommands.slice(0, 6);
    }

    // Match root command/subcommand
    for (const cmd of baseCommands) {
      if (cmd.text.startsWith(trimmed.toLowerCase())) {
        suggestions.push(cmd);
      }
    }

    // If typing task IDs after a command like "task complete " or "task show "
    if (trimmed.startsWith('task complete ') || trimmed.startsWith('task show ') || trimmed.startsWith('tc ')) {
      const tasks = await prisma.task.findMany({
        where: { workspaceId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true },
      });

      for (const t of tasks) {
        suggestions.push({
          text: t.id.slice(0, 8),
          description: `${t.title} (${t.status})`,
          category: 'task',
        });
      }
    }

    return suggestions;
  }
}

export const terminalService = new TerminalService();
