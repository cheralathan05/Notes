import crypto from 'crypto';
import { config } from '../config';

// Key derivation for AES-256-GCM encryption of provider tokens
const ENCRYPTION_SALT = 'atlas-github-token-salt-v1';
const KEY = crypto.scryptSync(config.sessionSecret, ENCRYPTION_SALT, 32);

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  updatedAt: string;
  language: string | null;
  starsCount: number;
}

export interface GitHubCommitSummary {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  avatarUrl?: string;
  date: string;
  url: string;
}

export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  isDraft: boolean;
  author: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
}

export class GitHubService {
  /**
   * Encrypt an access token using AES-256-GCM
   */
  static encryptToken(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an access token using AES-256-GCM
   */
  static decryptToken(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted token format');
    }
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Verify token authenticity and retrieve authenticated GitHub profile
   */
  static async verifyToken(token: string): Promise<{
    valid: boolean;
    user?: GitHubUser;
    scopes?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
        },
      });

      const scopes = response.headers.get('x-oauth-scopes') || '';

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or revoked GitHub credentials.' };
      }

      if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          return { valid: false, error: 'GitHub API rate limit exceeded. Please try again later.' };
        }
        return { valid: false, error: 'Insufficient permissions or access forbidden by GitHub.' };
      }

      if (!response.ok) {
        return { valid: false, error: `GitHub API error (HTTP ${response.status})` };
      }

      const data: any = await response.json();
      return {
        valid: true,
        scopes,
        user: {
          id: data.id,
          login: data.login,
          name: data.name || null,
          avatar_url: data.avatar_url,
          html_url: data.html_url,
          email: data.email || null,
        },
      };
    } catch (err: any) {
      return { valid: false, error: `Failed to connect to GitHub API: ${err.message}` };
    }
  }

  /**
   * List all repositories accessible to the authenticated GitHub token
   */
  static async listUserRepositories(token: string): Promise<GitHubRepoSummary[]> {
    const response = await fetch(
      'https://api.github.com/user/repos?sort=updated&direction=desc&per_page=100&affiliation=owner,collaborator,organization_member',
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errText}`);
    }

    const repos = (await response.json()) as any[];
    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || '',
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      description: r.description || null,
      updatedAt: r.updated_at,
      language: r.language || null,
      starsCount: r.stargazers_count || 0,
    }));
  }

  /**
   * Retrieve a specific repository's metadata
   */
  static async getRepository(token: string, owner: string, repo: string): Promise<GitHubRepoSummary> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repository ${owner}/${repo}: HTTP ${response.status}`);
    }

    const r: any = await response.json();
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || '',
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      description: r.description || null,
      updatedAt: r.updated_at,
      language: r.language || null,
      starsCount: r.stargazers_count || 0,
    };
  }

  /**
   * Fetch recent commits for a repository
   */
  static async getCommits(
    token: string,
    owner: string,
    repo: string,
    limit: number = 20
  ): Promise<GitHubCommitSummary[]> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${Math.min(limit, 50)}`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch commits for ${owner}/${repo}: HTTP ${response.status}`);
    }

    const commits = (await response.json()) as any[];
    return commits.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.commit?.message?.split('\n')[0] || 'Commit',
      authorName: c.commit?.author?.name || c.author?.login || 'Author',
      authorEmail: c.commit?.author?.email || '',
      avatarUrl: c.author?.avatar_url,
      date: c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString(),
      url: c.html_url,
    }));
  }

  /**
   * Fetch pull requests for a repository
   */
  static async getPullRequests(
    token: string,
    owner: string,
    repo: string,
    limit: number = 15
  ): Promise<GitHubPullRequestSummary[]> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=${Math.min(limit, 30)}&sort=updated&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pull requests for ${owner}/${repo}: HTTP ${response.status}`);
    }

    const pulls = (await response.json()) as any[];
    return pulls.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      isDraft: Boolean(p.draft),
      author: p.user?.login || 'User',
      authorAvatarUrl: p.user?.avatar_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      url: p.html_url,
      sourceBranch: p.head?.ref || '',
      targetBranch: p.base?.ref || 'main',
    }));
  }

  /**
   * Fetch branches for a repository
   */
  static async getBranches(
    token: string,
    owner: string,
    repo: string
  ): Promise<Array<{ name: string; commitSha: string; protected: boolean }>> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Project-Atlas-Collaboration-Platform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch branches for ${owner}/${repo}: HTTP ${response.status}`);
    }

    const branches = (await response.json()) as any[];
    return branches.map((b) => ({
      name: b.name,
      commitSha: b.commit?.sha || '',
      protected: Boolean(b.protected),
    }));
  }
}
