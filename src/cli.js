#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildContextPack, buildWeightedTerms, rankPaths } from "./context-pack.js";
import { GitHubClient, parseIssueUrl } from "./github.js";

function parseArguments(argv) {
  const [issueUrl, ...rest] = argv;
  if (!issueUrl || issueUrl === "--help" || issueUrl === "-h") {
    return { help: true };
  }

  const outputIndex = rest.indexOf("--output");
  if (outputIndex !== -1 && !rest[outputIndex + 1]) {
    throw new Error("--output requires a file path");
  }
  return { issueUrl, output: outputIndex === -1 ? undefined : rest[outputIndex + 1] };
}

function printHelp() {
  console.log("Usage: contextbridge <github-issue-url> [--output context-pack.md]");
}

export async function run(argv, client = new GitHubClient()) {
  const args = parseArguments(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const { owner, repo, issueNumber } = parseIssueUrl(args.issueUrl);
  const repository = await client.getRepository(owner, repo);
  if (repository.private !== false || (repository.visibility && repository.visibility !== "public")) {
    throw new Error("Repository must be explicitly public; no issue or content was fetched");
  }
  const issue = await client.getIssue(owner, repo, issueNumber);
  if (issue.pull_request) {
    throw new Error("The supplied URL points to a pull request, not an issue");
  }

  const warnings = [];
  const [readme, tree] = await Promise.all([
    client.getReadme(owner, repo).catch(() => {
      warnings.push("README retrieval failed; repository overview is unavailable.");
      return "_README could not be retrieved._";
    }),
    client.getTree(owner, repo, repository.default_branch),
  ]);
  if (tree.truncated) warnings.push("GitHub returned a truncated file tree; candidate-path coverage is incomplete.");
  const terms = buildWeightedTerms(issue.title, issue.body ?? "");
  const paths = tree.tree.filter((item) => item.type === "blob").map((item) => item.path);
  const rankedPaths = rankPaths(paths, terms);
  const historyCandidates = rankedPaths.slice(0, 5);
  const historyResults = await Promise.all(historyCandidates.map(async ({ path }) => {
    const commits = await client.getCommitsForPath(owner, repo, path).catch(() => {
      warnings.push(`Commit history retrieval failed for ${JSON.stringify(path)}; an empty result does not mean no history exists.`);
      return [];
    });
    return [path, commits];
  }));
  const relatedResponse = await client
    .searchRelatedIssues(owner, repo, terms.map(({ term }) => term))
    .catch(() => {
      warnings.push("Related-issue retrieval failed; an empty result does not mean no related issues exist.");
      return { items: [] };
    });
  if (relatedResponse.incomplete_results) warnings.push("GitHub returned incomplete related-issue search results.");
  const relatedIssues = relatedResponse.items
    .filter((item) => item.number !== issue.number)
    .slice(0, 5);
  const markdown = buildContextPack({
    repository,
    issue,
    readme,
    rankedPaths,
    commitsByPath: Object.fromEntries(historyResults),
    relatedIssues,
    warnings: warnings.sort(),
    generatedAt: new Date().toISOString(),
  });

  if (args.output) {
    await writeFile(args.output, markdown, "utf8");
    console.log(`Wrote ${args.output}`);
  } else {
    process.stdout.write(markdown);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(`ContextBridge: ${error.message}`);
    process.exitCode = 1;
  });
}

