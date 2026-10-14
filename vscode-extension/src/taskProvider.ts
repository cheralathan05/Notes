import * as vscode from 'vscode';
import { AtlasExtensionApi, TaskItem } from './api';

export class AtlasTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly task?: TaskItem,
    public readonly group?: string
  ) {
    super(label, collapsibleState);

    if (task) {
      this.contextValue = 'taskItem';
      this.id = task.id;
      const criteriaCount = task.acceptanceCriteria?.length || 0;
      const verifiedBadge = task.isVerified ? '✓ ' : '';
      this.description = `${verifiedBadge}[${task.priority}] ${criteriaCount > 0 ? `(${criteriaCount} criteria)` : ''}`;
      this.tooltip = new vscode.MarkdownString(
        `### ${task.title}\n\n` +
        `**Status**: ${task.status} | **Priority**: ${task.priority}\n\n` +
        (task.description ? `${task.description}\n\n` : '') +
        (task.claimedById ? `*Currently Claimed*\n\n` : '') +
        (criteriaCount > 0 ? `**Acceptance Criteria**:\n` + task.acceptanceCriteria!.map(c => `- [${c.isCompleted ? 'x' : ' '}] ${c.text}`).join('\n') : '')
      );

      switch (task.status) {
        case 'IN_PROGRESS':
          this.iconPath = new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.blue'));
          break;
        case 'DONE':
          this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
          break;
        default:
          this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.yellow'));
          break;
      }
    } else {
      this.contextValue = 'groupItem';
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

export class AtlasTaskProvider implements vscode.TreeDataProvider<AtlasTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AtlasTreeItem | undefined | void> = new vscode.EventEmitter<AtlasTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AtlasTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private tasks: TaskItem[] = [];

  constructor(private api: AtlasExtensionApi) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AtlasTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AtlasTreeItem): Promise<AtlasTreeItem[]> {
    if (!element) {
      try {
        this.tasks = await this.api.getAssignedTasks();
        return [
          new AtlasTreeItem('In Progress', vscode.TreeItemCollapsibleState.Expanded, undefined, 'IN_PROGRESS'),
          new AtlasTreeItem('To Do', vscode.TreeItemCollapsibleState.Expanded, undefined, 'TODO'),
          new AtlasTreeItem('Done', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'DONE'),
        ];
      } catch (err: any) {
        vscode.window.showErrorMessage(`Atlas: Failed to load tasks: ${err.message}`);
        return [];
      }
    }

    if (element.group) {
      const filtered = this.tasks.filter((t) => {
        if (element.group === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
        if (element.group === 'DONE') return t.status === 'DONE';
        return t.status === 'TODO' || t.status === 'BACKLOG';
      });

      return filtered.map(
        (task) => new AtlasTreeItem(task.title, vscode.TreeItemCollapsibleState.None, task)
      );
    }

    return [];
  }
}
