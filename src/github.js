const ISSUE_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/;

export function parseIssueUrl(value) {
  const match = ISSUE_URL_PATTERN.exec(value);
  if (!match) {
    throw new Error("Expected a GitHub issue URL like https://github.com/owner/repo/issues/123");
  }

  return {
    owner: match[1],
    repo: match[2],
    issueNumber: Number(match[3]),
  };
}

export class GitHubClient {
  constructor({ token = process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(path, accept = "application/vnd.github+json", responseType = "json") {
    const headers = {
      Accept: accept,
      "User-Agent": "contextbridge/0.1",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.fetch(`https://api.github.com${path}`, { headers });
    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const suffix = remaining === "0" ? " GitHub's API rate limit is exhausted." : "";
      throw new Error(`GitHub request failed (${response.status}) for ${path}.${suffix}`);
    }
    return responseType === "text" ? response.text() : response.json();
  }

  getRepository(owner, repo) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  getIssue(owner, repo, issueNumber) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
    );
  }

  getReadme(owner, repo) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      "application/vnd.github.raw+json",
      "text",
    );
  }

  getTree(owner, repo, treeSha) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
    );
  }

  getCommitsForPath(owner, repo, path, limit = 3) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?path=${encodeURIComponent(path)}&per_page=${limit}`,
    );
  }

  searchRelatedIssues(owner, repo, terms, limit = 5) {
    const query = [`repo:${owner}/${repo}`, "is:issue", ...terms.slice(0, 4)].join(" ");
    return this.request(`/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}`);
  }
}

