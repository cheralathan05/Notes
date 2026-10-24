import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  relativeDate: string;
  associatedTaskId?: string;
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  commitHash: string;
  commitDate: string;
  subject: string;
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'U';
  staged: boolean;
  rawCode: string;
}

export interface GitWorkingTreeStatus {
  branch: string;
  tracking?: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  isClean: boolean;
}

export interface GitRepositoryMetadata {
  isGit: boolean;
  rootDir?: string;
  repoName?: string;
  currentBranch?: string;
  defaultBranch?: string;
  remoteUrl?: string;
  latestCommit?: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
    relativeDate: string;
  };
  changedFilesCount: number;
  isClean: boolean;
}

export class GitService {
  private static readonly MAX_BUFFER = 4 * 1024 * 1024; // 4MB
  private static readonly DEFAULT_TIMEOUT = 8000; // 8 seconds

  /**
   * Safely execute git using argument arrays (NO shell interpolation)
   */
  private static execGit(
    args: string[],
    cwd: string,
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      // Validate that cwd exists
      if (!fs.existsSync(cwd)) {
        return reject(new Error(`Path does not exist: "${cwd}"`));
      }

      execFile(
        'git',
        args,
        {
          cwd,
          timeout: timeoutMs,
          maxBuffer: this.MAX_BUFFER,
          windowsHide: true,
          env: {
            ...process.env,
            LC_ALL: 'C', // Ensure deterministic output across locales
            GIT_TERMINAL_PROMPT: '0', // Disallow interactive credentials prompts
          },
        },
        (error, stdout, stderr) => {
          if (error && (error as any).killed) {
            return reject(new Error(`Git command timed out after ${timeoutMs}ms: git ${args.join(' ')}`));
          }
          const exitCode = error ? (error.code ?? 1) : 0;
          resolve({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            code: typeof exitCode === 'number' ? exitCode : 1,
          });
        }
      );
    });
  }

  /**
   * Verify if a path is inside a genuine Git repository
   */
  public static async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(repoPath)) return false;
      const res = await this.execGit(['rev-parse', '--is-inside-work-tree'], repoPath, 3000);
      return res.code === 0 && res.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get root top-level directory of the Git repo
   */
  public static async getRootDir(repoPath: string): Promise<string | null> {
    try {
      const res = await this.execGit(['rev-parse', '--show-toplevel'], repoPath);
      if (res.code === 0 && res.stdout.trim()) {
        return path.normalize(res.stdout.trim());
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Read comprehensive repository metadata from working tree
   */
  public static async getRepositoryMetadata(repoPath: string): Promise<GitRepositoryMetadata> {
    const isGit = await this.isGitRepository(repoPath);
    if (!isGit) {
      return {
        isGit: false,
        changedFilesCount: 0,
        isClean: true,
      };
    }

    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    const repoName = path.basename(rootDir);

    // Current Branch
    let currentBranch = 'main';
    try {
      const branchRes = await this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir);
      if (branchRes.code === 0 && branchRes.stdout.trim()) {
        currentBranch = branchRes.stdout.trim();
      }
    } catch {
      // Fallback
    }

    // Remote URL
    let remoteUrl: string | undefined;
    try {
      const remoteRes = await this.execGit(['config', '--get', 'remote.origin.url'], rootDir);
      if (remoteRes.code === 0 && remoteRes.stdout.trim()) {
        remoteUrl = remoteRes.stdout.trim();
      }
    } catch {
      // No remote
    }

    // Default Branch
    let defaultBranch = currentBranch;
    try {
      const headRefRes = await this.execGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], rootDir);
      if (headRefRes.code === 0 && headRefRes.stdout.trim()) {
        defaultBranch = headRefRes.stdout.trim().replace(/^refs\/remotes\/origin\//, '');
      }
    } catch {
      // Fallback to main or master
    }

    // Latest Commit
    let latestCommit: GitRepositoryMetadata['latestCommit'] = undefined;
    try {
      const commitRes = await this.execGit(
        ['log', '-1', '--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%ar'],
        rootDir
      );
      if (commitRes.code === 0 && commitRes.stdout.trim()) {
        const [hash, shortHash, message, author, date, relativeDate] = commitRes.stdout.trim().split('\x1f');
        if (hash) {
          latestCommit = { hash, shortHash, message, author, date, relativeDate };
        }
      }
    } catch {
      // Empty repo with no commits
    }

    // Status & Changed files count
    let changedFilesCount = 0;
    let isClean = true;
    try {
      const statusRes = await this.execGit(['status', '--porcelain=v1'], rootDir);
      if (statusRes.code === 0) {
        const lines = statusRes.stdout.split('\n').filter((l) => l.trim().length > 0);
        changedFilesCount = lines.length;
        isClean = changedFilesCount === 0;
      }
    } catch {
      // Ignore
    }

    return {
      isGit: true,
      rootDir,
      repoName,
      currentBranch,
      defaultBranch,
      remoteUrl,
      latestCommit,
      changedFilesCount,
      isClean,
    };
  }

  /**
   * Retrieve real branches from repository
   */
  public static async getBranches(repoPath: string): Promise<GitBranchItem[]> {
    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    if (!rootDir) return [];

    try {
      // List local and remote branches with format
      const res = await this.execGit(
        [
          'branch',
          '-a',
          '--format=%(HEAD)|%(refname:short)|%(objectname:short)|%(committerdate:iso-strict)|%(contents:subject)',
        ],
        rootDir
      );

      if (res.code !== 0) return [];

      const lines = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      const branches: GitBranchItem[] = [];

      for (const line of lines) {
        const parts = line.split('|');
        const isHead = parts[0]?.trim() === '*';
        const rawName = parts[1]?.trim() || '';
        const commitHash = parts[2]?.trim() || '';
        const commitDate = parts[3]?.trim() || '';
        const subject = parts[4]?.trim() || '';

        if (!rawName || rawName.includes('origin/HEAD')) continue;

        const isRemote = rawName.startsWith('origin/') || rawName.startsWith('remotes/');
        const cleanName = rawName.replace(/^remotes\//, '');

        // Deduplicate local vs remote tracking branches in listing
        branches.push({
          name: cleanName,
          isCurrent: isHead,
          isRemote,
          commitHash,
          commitDate,
          subject,
        });
      }

      return branches;
    } catch (error) {
      console.error('Error fetching git branches:', error);
      return [];
    }
  }

  /**
   * Retrieve real commit history from repository
   */
  public static async getCommits(repoPath: string, limit: number = 30): Promise<GitCommitItem[]> {
    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    if (!rootDir) return [];

    try {
      const res = await this.execGit(
        [
          'log',
          `-n${Math.min(limit, 100)}`,
          '--format=%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%ar',
        ],
        rootDir
      );

      if (res.code !== 0) return [];

      const lines = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      const commits: GitCommitItem[] = [];

      for (const line of lines) {
        const [hash, shortHash, message, authorName, authorEmail, date, relativeDate] = line.split('\x1f');
        if (!hash) continue;

        // Detect task ID pattern in commit message, e.g. [TASK-123], #TASK-123, or (task-xyz)
        const taskMatch = message?.match(/\[?(?:TASK-)?([a-z0-9_-]{6,})\]?/i);
        const associatedTaskId = taskMatch ? taskMatch[1] : undefined;

        commits.push({
          hash,
          shortHash: shortHash || hash.slice(0, 7),
          message: message || 'No message',
          authorName: authorName || 'Unknown',
          authorEmail: authorEmail || '',
          date: date || new Date().toISOString(),
          relativeDate: relativeDate || '',
          associatedTaskId,
        });
      }

      return commits;
    } catch (error) {
      console.error('Error fetching git commits:', error);
      return [];
    }
  }

  /**
   * Retrieve working-tree status: modified files, untracked, branch status
   */
  public static async getWorkingTreeStatus(repoPath: string): Promise<GitWorkingTreeStatus> {
    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    if (!rootDir) {
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        files: [],
        isClean: true,
      };
    }

    try {
      const res = await this.execGit(['status', '--porcelain=v1', '-b'], rootDir);
      if (res.code !== 0) {
        return { branch: 'unknown', ahead: 0, behind: 0, files: [], isClean: true };
      }

      const lines = res.stdout.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length > 0);
      let branch = 'main';
      let tracking: string | undefined;
      let ahead = 0;
      let behind = 0;
      const files: GitFileStatus[] = [];

      for (const line of lines) {
        if (line.startsWith('## ')) {
          // Header line, e.g. ## main...origin/main [ahead 1, behind 2]
          const header = line.slice(3).trim();
          const branchPart = header.split(' ')[0];
          const [local, remote] = branchPart.split('...');
          branch = local;
          tracking = remote;

          const aheadMatch = header.match(/ahead (\d+)/);
          if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

          const behindMatch = header.match(/behind (\d+)/);
          if (behindMatch) behind = parseInt(behindMatch[1], 10);
        } else if (line.length >= 3) {
          const indexCode = line[0];
          const worktreeCode = line[1];
          const filePath = line.slice(3).trim().replace(/^"|"$/g, '');

          let status: GitFileStatus['status'] = 'M';
          let staged = false;

          if (indexCode === '?' && worktreeCode === '?') {
            status = '?';
          } else if (indexCode === 'A' || worktreeCode === 'A') {
            status = 'A';
            staged = indexCode === 'A';
          } else if (indexCode === 'D' || worktreeCode === 'D') {
            status = 'D';
            staged = indexCode === 'D';
          } else if (indexCode === 'R' || worktreeCode === 'R') {
            status = 'R';
            staged = indexCode === 'R';
          } else if (indexCode === 'U' || worktreeCode === 'U') {
            status = 'U';
          } else {
            status = 'M';
            staged = indexCode !== ' ' && indexCode !== '?';
          }

          files.push({
            path: filePath,
            status,
            staged,
            rawCode: line.slice(0, 2),
          });
        }
      }

      return {
        branch,
        tracking,
        ahead,
        behind,
        files,
        isClean: files.length === 0,
      };
    } catch (error) {
      console.error('Error getting working tree status:', error);
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        files: [],
        isClean: true,
      };
    }
  }

  /**
   * Retrieve unified diff safely with path restriction and line limit
   */
  public static async getDiff(
    repoPath: string,
    targetFile?: string,
    maxLines: number = 500
  ): Promise<{ diff: string; truncated: boolean }> {
    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    if (!rootDir) return { diff: '', truncated: false };

    try {
      const args = ['diff', 'HEAD', '--no-color'];
      if (targetFile) {
        // Prevent path traversal
        const resolved = path.resolve(rootDir, targetFile);
        if (!resolved.startsWith(rootDir)) {
          throw new Error('Access denied: Path outside repository boundary');
        }
        args.push('--', targetFile);
      }

      const res = await this.execGit(args, rootDir);
      let output = res.stdout;

      // If HEAD has no diff or error (e.g. untracked files or staged files), check unstaged
      if (!output.trim()) {
        const unstagedRes = await this.execGit(['diff', '--no-color', '--', targetFile || '.'], rootDir);
        output = unstagedRes.stdout;
      }

      const lines = output.split('\n');
      const truncated = lines.length > maxLines;
      const trimmedOutput = truncated ? lines.slice(0, maxLines).join('\n') + '\n\n[Diff truncated...]' : output;

      return {
        diff: trimmedOutput,
        truncated,
      };
    } catch (error: any) {
      if (error?.message?.includes('Access denied')) {
        throw error;
      }
      console.error('Error fetching git diff:', error);
      return { diff: '', truncated: false };
    }
  }

  /**
   * Retrieve diff between two branches or commit references safely
   */
  public static async getBranchDiff(
    repoPath: string,
    targetBranch: string = 'main',
    sourceBranch: string = 'HEAD',
    maxLines: number = 800
  ): Promise<string> {
    const rootDir = (await this.getRootDir(repoPath)) || repoPath;
    if (!rootDir) return '';

    try {
      const cleanTarget = targetBranch.trim().replace(/[^a-zA-Z0-9_\-\.\/]/g, '');
      const cleanSource = sourceBranch.trim().replace(/[^a-zA-Z0-9_\-\.\/]/g, '');
      const res = await this.execGit(['diff', `${cleanTarget}...${cleanSource}`, '--no-color'], rootDir);
      let output = res.stdout;
      if (!output.trim()) {
        const directRes = await this.execGit(['diff', cleanTarget, cleanSource, '--no-color'], rootDir);
        output = directRes.stdout;
      }
      const lines = output.split('\n');
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') + '\n\n[Diff truncated for performance...]';
      }
      return output;
    } catch (err) {
      console.warn('Failed to retrieve branch diff:', err);
      return '';
    }
  }
}
