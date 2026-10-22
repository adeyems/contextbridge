const STOP_WORDS = new Set([
  "about", "after", "also", "and", "been", "before", "being", "from", "have",
  "into", "issue", "should", "that", "their", "there", "these", "this",
  "with", "would", "when", "where", "which", "while", "your",
]);

export function extractTerms(text) {
  return [...new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9_-]{2,}/g)
      ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
  )];
}

export function rankPaths(paths, terms, limit = 12) {
  return paths
    .filter((path) => !path.endsWith("/") && !path.includes("node_modules/"))
    .map((path) => {
      const normalized = path.toLowerCase();
      const matchedTerms = terms.filter((term) => normalized.includes(term));
      const testBonus = /(^|\/)(test|tests|spec|specs)(\/|\.)/.test(normalized) ? 0.25 : 0;
      return { path, matchedTerms, score: matchedTerms.length + testBonus };
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

export function buildContextPack({ repository, issue, readme, rankedPaths, generatedAt }) {
  const pathLines = rankedPaths.length
    ? rankedPaths.map(({ path, matchedTerms }) => {
        const evidenceUrl = `${repository.html_url}/blob/${repository.default_branch}/${path}`;
        return `- [\`${path}\`](${evidenceUrl}) — matched: ${matchedTerms.join(", ") || "test path"}`;
      }).join("\n")
    : "_No paths matched the issue terms. Manual repository review is required._";

  return `# Context pack: ${issue.title}\n\n` +
    `Generated: ${generatedAt}\n\n` +
    `## Task evidence\n\n` +
    `- Issue: [#${issue.number} ${issue.title}](${issue.html_url})\n` +
    `- Repository: [${repository.full_name}](${repository.html_url})\n` +
    `- Default branch: \`${repository.default_branch}\`\n` +
    `- Licence reported by GitHub: ${repository.license?.spdx_id ?? "not detected"}\n\n` +
    `### Issue description\n\n${clip(issue.body, 6000)}\n\n` +
    `## Candidate paths\n\n${pathLines}\n\n` +
    `## Repository overview\n\n${clip(readme, 5000)}\n\n` +
    `## Review checklist\n\n` +
    `- [ ] Confirm the task objective and acceptance criteria.\n` +
    `- [ ] Inspect each candidate path before making changes.\n` +
    `- [ ] Find relevant tests, prior decisions, commits and pull requests.\n` +
    `- [ ] Record missing context and unanswered questions.\n` +
    `- [ ] Remove irrelevant evidence before exporting this pack.\n\n` +
    `> This pack is a retrieval aid, not proof that all relevant context was found.\n`;
}

