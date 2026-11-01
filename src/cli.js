#!/usr/bin/env node

import { open, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildContextPack, buildWeightedTerms, rankPaths } from "./context-pack.js";
import { GitHubClient, parseIssueUrl } from "./github.js";

function parseArguments(argv) {
  const [issueUrl, ...rest] = argv;
  if (!issueUrl || issueUrl === "--help" || issueUrl === "-h") {
    return { help: true };
  }

  const args = { issueUrl };
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i];
    if (!["--output", "--review-notes"].includes(option) || !rest[i + 1] || rest[i + 1].startsWith("--")) {
      throw new Error("Expected --output PATH or --review-notes PATH");
    }
    const key = option === "--output" ? "output" : "reviewNotes";
    if (args[key]) throw new Error(`Duplicate option ${option}`);
    args[key] = rest[i + 1];
  }
  return args;
}

function printHelp() {
  console.log("Usage: contextbridge <github-issue-url> [--output context-pack.md] [--review-notes notes.json]");
}

export async function loadReviewNotes(path) {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(16385);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > 16384) throw new Error("Review notes exceed 16 KiB");
    const notes = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size)));
    if (!notes || Array.isArray(notes) || Object.keys(notes).sort().join(",") !== "questions,risks,version" || notes.version !== 1) {
      throw new Error("Review notes require version 1, questions and risks");
    }
    for (const key of ["questions", "risks"]) {
      if (!Array.isArray(notes[key]) || notes[key].length > 20 || notes[key].some(value => typeof value !== "string" || !value.trim() || value.length > 500 || /[\x00-\x1f\x7f]/.test(value))) {
        throw new Error("Review notes require at most 20 nonempty single-line strings per section, up to 500 characters each");
      }
    }
    return notes;
  } finally { await file.close(); }
}

export async function run(argv, client = new GitHubClient()) {
  const args = parseArguments(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const reviewNotes = args.reviewNotes ? await loadReviewNotes(args.reviewNotes) : undefined;
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
    reviewNotes,
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

