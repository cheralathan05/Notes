import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AtlasConfig {
  apiUrl: string;
  token?: string;
  workspaceId?: string;
  userEmail?: string;
}

export interface LocalProjectConfig {
  repoName: string;
  workspaceId?: string;
  projectId?: string;
  repositoryId?: string;
}

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.atlas');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_DIR = '.atlas';
const LOCAL_CONFIG_FILE = path.join(LOCAL_CONFIG_DIR, 'project.json');

export function getGlobalConfig(): AtlasConfig {
  const envUrl = process.env.ATLAS_API_URL;
  const envToken = process.env.ATLAS_TOKEN;

  let fileConfig: Partial<AtlasConfig> = {};
  if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8'));
    } catch {
      // Ignore corrupt file
    }
  }

  return {
    apiUrl: envUrl || fileConfig.apiUrl || 'http://localhost:4000',
    token: envToken || fileConfig.token,
    workspaceId: fileConfig.workspaceId,
    userEmail: fileConfig.userEmail,
  };
}

export function saveGlobalConfig(config: Partial<AtlasConfig>): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  const current = getGlobalConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function clearGlobalAuth(): void {
  const current = getGlobalConfig();
  delete current.token;
  delete current.userEmail;
  if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
    fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(current, null, 2), 'utf-8');
  }
}

export const clearGlobalConfig = clearGlobalAuth;

export function getLocalProjectConfig(): LocalProjectConfig | null {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

export function saveLocalProjectConfig(config: LocalProjectConfig): void {
  if (!fs.existsSync(LOCAL_CONFIG_DIR)) {
    fs.mkdirSync(LOCAL_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function removeLocalProjectConfig(): boolean {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) {
    try {
      fs.unlinkSync(LOCAL_CONFIG_FILE);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

