// Storage adapters. Both expose the same small interface so the repository
// above them doesn't care where JSON files live:
//   read(path)                      → { data, sha } | null
//   write(path, data, sha, message) → newSha        (throws ConflictError on stale sha)
//   list(dir)                       → [fileName]
//   check()                         → throws with a human message when unusable

export class ConflictError extends Error {}
export class OfflineError extends Error {}
export class AuthError extends Error {}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export class GitHubStore {
  constructor({ owner, repo, token, branch = 'main' }) {
    Object.assign(this, { owner, repo, token, branch });
    this.id = `gh:${owner}/${repo}`;
  }

  async #request(method, path, body) {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}${path}`, {
        method,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new OfflineError('No connection to GitHub');
    }
    if (res.status === 401) throw new AuthError('GitHub rejected the token (expired or revoked?)');
    if (res.status === 409 || (res.status === 422 && method === 'PUT')) throw new ConflictError('File changed remotely');
    return res;
  }

  async check() {
    const res = await this.#request('GET', '');
    if (res.status === 404) throw new Error(`Repo ${this.owner}/${this.repo} not found, or the token can’t see it`);
    if (!res.ok) throw new Error(`GitHub error ${res.status}`);
    const info = await res.json();
    if (info.permissions && !info.permissions.push) throw new Error('The token has read-only access; it needs Contents: Read and write');
  }

  async read(path) {
    const res = await this.#request('GET', `/contents/${path}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub error ${res.status} reading ${path}`);
    const json = await res.json();
    return { data: JSON.parse(base64ToUtf8(json.content)), sha: json.sha };
  }

  async write(path, data, sha, message) {
    const res = await this.#request('PUT', `/contents/${path}`, {
      message,
      branch: this.branch,
      content: utf8ToBase64(JSON.stringify(data, null, 2) + '\n'),
      ...(sha ? { sha } : {}),
    });
    if (!res.ok) throw new Error(`GitHub error ${res.status} writing ${path}`);
    return (await res.json()).content.sha;
  }

  async list(dir) {
    const res = await this.#request('GET', `/contents/${dir}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub error ${res.status} listing ${dir}`);
    return (await res.json()).filter((f) => f.type === 'file').map((f) => f.name);
  }
}

/** Browser-only store for demo mode. Same semantics, including sha conflicts. */
export class LocalStore {
  constructor(prefix = 'demo') {
    this.prefix = prefix;
    this.id = `local:${prefix}`;
  }

  #key(path) { return `${this.prefix}:file:${path}`; }

  async check() {}

  async read(path) {
    const rawValue = localStorage.getItem(this.#key(path));
    return rawValue ? JSON.parse(rawValue) : null;
  }

  async write(path, data, sha) {
    const current = await this.read(path);
    if ((current?.sha ?? null) !== (sha ?? null)) throw new ConflictError('File changed');
    const next = Math.random().toString(36).slice(2);
    localStorage.setItem(this.#key(path), JSON.stringify({ data, sha: next }));
    return next;
  }

  async list(dir) {
    const start = this.#key(`${dir}/`);
    return Object.keys(localStorage).filter((k) => k.startsWith(start)).map((k) => k.slice(start.length));
  }
}
