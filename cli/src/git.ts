import { execSync } from 'child_process';
import * as path from 'path';

export interface LocalGitInfo {
  isGitRepo: boolean;
  rootDir?: string;
  repoName?: string;
  currentBranch?: string;
  latestCommit?: string;
  remoteUrl?: string;
  changedFiles: string[];
}

function runGit(command: string): string | null {
  try {
    return execSync(`git ${command}`, {
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

export function getLocalGitInfo(): LocalGitInfo {
  const rootDir = runGit('rev-parse --show-toplevel');
  if (!rootDir) {
    return { isGitRepo: false, changedFiles: [] };
  }

  const repoName = path.basename(rootDir);
  const currentBranch = runGit('rev-parse --abbrev-ref HEAD') || 'main';
  const latestCommit = runGit('rev-parse --short HEAD') || undefined;
  const remoteUrl = runGit('config --get remote.origin.url') || undefined;

  const rawStatus = runGit('status --porcelain') || '';
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
    remoteUrl,
    changedFiles,
  };
}

export const getGitInfo = getLocalGitInfo;
