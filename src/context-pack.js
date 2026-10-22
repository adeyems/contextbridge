const STOP_WORDS = new Set([
  "about", "add", "after", "also", "and", "are", "back", "been", "before",
  "being", "can", "could", "does", "expected", "for", "from", "have", "into",
  "issue", "not", "should", "that", "the", "their", "there", "these", "this",
  "use", "using", "was", "were", "will", "with", "would", "when", "where",
  "which", "while", "your",
]);

const SOURCE_EXTENSIONS = new Set([
  "c", "cc", "cpp", "cs", "css", "go", "h", "hpp", "html", "java", "js",
  "jsx", "kt", "php", "py", "rb", "rs", "scala", "swift", "ts", "tsx",
]);

export function extractTerms(text) {
  return [...new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9_-]{2,}/g)
      ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
  )];
}

export function buildWeightedTerms(title, body = "") {
  const weights = new Map();
  for (const term of extractTerms(body)) weights.set(term, 1);
  for (const term of extractTerms(title)) weights.set(term, 3);
  return [...weights].map(([term, weight]) => ({ term, weight }));
}

export function rankPaths(paths, terms, limit = 12) {
  const weightedTerms = terms.map((value) =>
    typeof value === "string" ? { term: value, weight: 1 } : value,
  );

  return paths
    .filter((path) => !path.endsWith("/") && !path.includes("node_modules/"))
    .map((path) => {
      const normalized = path.toLowerCase();
      const matchedTerms = weightedTerms.filter(({ term }) => normalized.includes(term));
      const testBonus = /(^|\/)(test|tests|spec|specs)(\/|\.)/.test(normalized) ? 0.25 : 0;
      const extension = normalized.split(".").pop();
      const sourceBonus = SOURCE_EXTENSIONS.has(extension) ? 0.1 : 0;
      const reasons = matchedTerms.map(({ term, weight }) =>
        weight > 1 ? `title term “${term}”` : `description term “${term}”`,
      );
      if (testBonus) reasons.push("test path");
      if (sourceBonus) reasons.push("source file");
      return {
        path,
        matchedTerms: matchedTerms.map(({ term }) => term),
        reasons,
        score: matchedTerms.reduce((sum, { weight }) => sum + weight, 0) + testBonus + sourceBonus,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function clip(value, maxLength) {
  if (!value) return "_Not provided._";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}\n\n_[Content clipped by ContextBridge.]_`;
}

export function buildContextPack({
  repository,
  issue,
  readme,
  rankedPaths,
  commitsByPath = {},
  relatedIssues = [],
  generatedAt,
}) {
  const pathLines = rankedPaths.length
    ? rankedPaths.map(({ path, reasons, matchedTerms }) => {
        const evidenceUrl = `${repository.html_url}/blob/${repository.default_branch}/${path}`;
        const explanation = reasons?.join("; ") || `matched: ${matchedTerms.join(", ")}`;
        return `- [\`${path}\`](${evidenceUrl}) — ${explanation}`;
      }).join("\n")
    : "_No paths matched the issue terms. Manual repository review is required._";

  const commitLines = Object.entries(commitsByPath).flatMap(([path, commits]) =>
    commits.map((commit) => {
      const summary = commit.commit.message.split("\n", 1)[0];
      const date = commit.commit.author?.date?.slice(0, 10) ?? "unknown date";
      return `- \`${path}\`: [${commit.sha.slice(0, 7)} ${summary}](${commit.html_url}) (${date})`;
    }),
  );
  const historySection = commitLines.length
    ? commitLines.join("\n")
    : "_No path-specific commit evidence was retrieved._";

  const relatedSection = relatedIssues.length
    ? relatedIssues.map((item) => `- [#${item.number} ${item.title}](${item.html_url})`).join("\n")
    : "_No related issues were retrieved._";

  return `# Context pack: ${issue.title}\n\n` +
    `Generated: ${generatedAt}\n\n` +
    `## Task evidence\n\n` +
    `- Issue: [#${issue.number} ${issue.title}](${issue.html_url})\n` +
    `- Repository: [${repository.full_name}](${repository.html_url})\n` +
    `- Default branch: \`${repository.default_branch}\`\n` +
    `- Licence reported by GitHub: ${repository.license?.spdx_id ?? "not detected"}\n\n` +
    `### Issue description\n\n${clip(issue.body, 6000)}\n\n` +
    `## Candidate paths\n\n${pathLines}\n\n` +
    `## Recent path history\n\n${historySection}\n\n` +
    `## Related issues\n\n${relatedSection}\n\n` +
    `## Repository overview\n\n${clip(readme, 5000)}\n\n` +
    `## Review checklist\n\n` +
    `- [ ] Confirm the task objective and acceptance criteria.\n` +
    `- [ ] Inspect each candidate path before making changes.\n` +
    `- [ ] Find relevant tests, prior decisions, commits and pull requests.\n` +
    `- [ ] Record missing context and unanswered questions.\n` +
    `- [ ] Remove irrelevant evidence before exporting this pack.\n\n` +
    `> This pack is a retrieval aid, not proof that all relevant context was found.\n`;
}

