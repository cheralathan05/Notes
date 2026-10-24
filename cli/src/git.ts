import { execSync } from 'child_process';
import * as path from 'path';

export interface LocalGitInfo {
  isGitRepo: boolean;
  rootDir?: string;
  repoName?: string;
  currentBranch?: string;
  latestCommit?: string;
  latestCommitHash?: string;
  latestCommitMessage?: string;
  remoteUrl?: string;
  changedFiles: string[];
}

function runGit(command: string, cwd?: string): string | null {
  try {
    return execSync(`git ${command}`, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

export function getLocalGitInfo(customDir?: string): LocalGitInfo {
  const cwd = customDir || process.cwd();
  const rootDir = runGit('rev-parse --show-toplevel', cwd);
  if (!rootDir) {
    return { isGitRepo: false, changedFiles: [] };
  }

  const repoName = path.basename(rootDir);
  const currentBranch = runGit('rev-parse --abbrev-ref HEAD', cwd) || 'main';
  const latestCommit = runGit('rev-parse --short HEAD', cwd) || undefined;
  const latestCommitHash = runGit('rev-parse HEAD', cwd) || undefined;
  const latestCommitMessage = runGit('log -1 --format=%s', cwd) || undefined;
  const remoteUrl = runGit('config --get remote.origin.url', cwd) || undefined;

  const rawStatus = runGit('status --porcelain', cwd) || '';
  const changedFiles = rawStatus
    ? rawStatus
        .split('\n')
        .map((line) => line.trim().slice(3))
        .filter(Boolean)
    : [];

  return {
    isGitRepo: true,
    rootDir,
    repoName,
    currentBranch,
    latestCommit,
    latestCommitHash,
    latestCommitMessage,
    remoteUrl,
    changedFiles,
  };
}

export function isGitInstalled(): boolean {
  try {
    const res = execSync('git --version', {
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8',
    });
    return Boolean(res && res.includes('git version'));
  } catch {
    return false;
  }
}

export const getGitInfo = getLocalGitInfo;
