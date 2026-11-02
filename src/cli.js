#!/usr/bin/env node

import { open, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildContextPack, buildWeightedTerms, rankPaths } from "./context-pack.js";
import { renderPack } from "./pack-view.js";
import { loadPack, comparePacks } from "./pack-compare.js";
import { GitHubClient, parseIssueUrl } from "./github.js";

function parseArguments(argv) {
  const [issueUrl, ...rest] = argv;
  if (!issueUrl || issueUrl === "--help" || issueUrl === "-h") {
    return { help: true };
  }

  const args = { issueUrl };
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i];
    if (!["--output", "--review-notes", "--format"].includes(option) || !rest[i + 1] || rest[i + 1].startsWith("--")) {
      throw new Error("Expected --output PATH, --review-notes PATH or --format markdown|json");
    }
    const key = option === "--output" ? "output" : option === "--format" ? "format" : "reviewNotes";
    if (args[key]) throw new Error(`Duplicate option ${option}`);
    args[key] = rest[i + 1];
  }
  if (args.format && !["markdown", "json"].includes(args.format)) throw new Error("Format must be markdown or json");
  return args;
}

function printHelp() {
  console.log("Local read-only viewer: contextbridge view PACK.json NEW.html");
  console.log("Offline comparison: contextbridge compare BEFORE.json AFTER.json");
  console.log("Usage: contextbridge <github-issue-url> [--output context-pack.md] [--review-notes notes.json] [--format markdown|json]");
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
  if (argv[0] === "view") {
    if (argv.length !== 3) throw new Error("Usage: contextbridge view PACK.json NEW.html");
    const pack = await loadPack(argv[1]);
    await writeFile(argv[2], renderPack(pack), {encoding:"utf8",flag:"wx",mode:0o600});
    console.log(`Wrote ${argv[2]}`);
    return 0;
  }
  if (argv[0] === "compare") {
    if (argv.length !== 3) throw new Error("Usage: contextbridge compare BEFORE.json AFTER.json");
    const before = await loadPack(argv[1]);
    const after = await loadPack(argv[2]);
    const report = comparePacks(before, after);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.match ? 0 : 1;
  }
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
  const generatedAt = new Date().toISOString();
  const markdown = buildContextPack({
    repository,
    issue,
    readme,
    rankedPaths,
    commitsByPath: Object.fromEntries(historyResults),
    relatedIssues,
    warnings: warnings.sort(),
    reviewNotes,
    generatedAt,
  });

  const output = args.format === "json" ? JSON.stringify({
    version: 1,
    generatedAt,
    source: { repositoryUrl: repository.html_url, issueUrl: issue.html_url, defaultBranch: repository.default_branch },
    warnings: [...warnings].sort(),
    markdown,
  }, null, 2) + "\n" : markdown;
  if (args.output) {
    await writeFile(args.output, output, "utf8");
    console.log(`Wrote ${args.output}`);
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(code => { if (typeof code === "number") process.exitCode = code; }).catch((error) => {
    console.error(`ContextBridge: ${error.message}`);
    process.exitCode = 1;
  });
}

