import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import repository from "./fixtures/github/repository.json" with { type: "json" };
import issue from "./fixtures/github/issue.json" with { type: "json" };
import tree from "./fixtures/github/tree.json" with { type: "json" };
import { run } from "../src/cli.js";

test("rejects private, unknown and internal visibility before fetching issue content", async () => {
  for (const metadata of [{private: true}, {}, {private: false, visibility: "internal"}]) {
    let issueFetched = false;
    await assert.rejects(run(["https://github.com/acme/widget/issues/42"], {
      async getRepository() { return metadata; },
      async getIssue() { issueFetched = true; throw new Error("must not fetch"); },
    }), /explicitly public/);
    assert.equal(issueFetched, false);
  }
});

test("partial retrieval is visible and successful empty results are distinct", async () => {
  const directory = await mkdtemp(join(tmpdir(), "contextbridge-warnings-"));
  const output = join(directory, "pack.md");
  let partial = true;
  const client = {
    async getRepository() { return repository; },
    async getIssue() { return issue; },
    async getTree() { return {...tree, truncated: partial}; },
    async getReadme() { if (partial) throw new Error("secret-like error must not leak"); return "Synthetic README"; },
    async getCommitsForPath() { if (partial) throw new Error("failed"); return []; },
    async searchRelatedIssues() { if (partial) throw new Error("failed"); return {items: []}; },
  };
  try {
    await run(["https://github.com/acme/widget/issues/42", "--output", output], client);
    const incomplete = await readFile(output, "utf8");
    for (const pattern of [/README retrieval failed/, /Commit history retrieval failed/, /Related-issue retrieval failed/, /truncated file tree/]) assert.match(incomplete, pattern);
    assert.doesNotMatch(incomplete, /secret-like/);
    partial = false;
    await run(["https://github.com/acme/widget/issues/42", "--output", output], client);
    assert.match(await readFile(output, "utf8"), /No retrieval failures or truncation were reported/);
    client.searchRelatedIssues = async () => ({items: [], incomplete_results: true});
    await run(["https://github.com/acme/widget/issues/42", "--output", output], client);
    assert.match(await readFile(output, "utf8"), /incomplete related-issue search/);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test("required tree failure stops pack generation", async () => {
  await assert.rejects(run(["https://github.com/acme/widget/issues/42"], {
    async getRepository() { return repository; },
    async getIssue() { return issue; },
    async getReadme() { return "Synthetic"; },
    async getTree() { throw new Error("tree unavailable"); },
  }), /tree unavailable/);
});

test("generates a deterministic context pack from GitHub fixtures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "contextbridge-"));
  const output = join(directory, "pack.md");
  const client = {
    async getRepository() { return repository; },
    async getIssue() { return issue; },
    async getReadme() { return "# Widget\nA webhook delivery service."; },
    async getTree() { return tree; },
    async getCommitsForPath(owner, repo, path) {
      return [{
        sha: "abcdef123456",
        html_url: `https://github.com/${owner}/${repo}/commit/abcdef123456`,
        commit: {
          message: `change ${path}`,
          author: { date: "2026-10-20T12:00:00Z" },
        },
      }];
    },
    async searchRelatedIssues() {
      return { items: [{
        number: 30,
        title: "Record failed deliveries",
        html_url: "https://github.com/acme/widget/issues/30",
      }] };
    },
  };

  try {
    await run([
      "https://github.com/acme/widget/issues/42",
      "--output",
      output,
    ], client);
    const markdown = await readFile(output, "utf8");
    assert.match(markdown, /Context pack: Retry webhook delivery/);
    assert.match(markdown, /title term “webhook”/);
    assert.match(markdown, /Recent path history/);
    assert.match(markdown, /Record failed deliveries/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
