import test from "node:test";
import assert from "node:assert/strict";
import { buildContextPack, extractTerms, rankPaths } from "../src/context-pack.js";
import { parseIssueUrl } from "../src/github.js";

test("parses a canonical public GitHub issue URL", () => {
  assert.deepEqual(parseIssueUrl("https://github.com/acme/widget/issues/42"), {
    owner: "acme",
    repo: "widget",
    issueNumber: 42,
  });
});

test("rejects pull requests and non-GitHub URLs", () => {
  assert.throws(() => parseIssueUrl("https://github.com/acme/widget/pull/42"));
  assert.throws(() => parseIssueUrl("https://example.com/acme/widget/issues/42"));
});

test("extracts distinct useful terms and ranks matching paths", () => {
  const terms = extractTerms("Add webhook delivery retries and webhook tests");
  assert.deepEqual(terms, ["add", "webhook", "delivery", "retries", "tests"]);

  const ranked = rankPaths([
    "src/webhook/delivery.js",
    "test/webhook.test.js",
    "src/users.js",
  ], terms);
  assert.equal(ranked[0].path, "src/webhook/delivery.js");
  assert.equal(ranked[0].score, 2);
  assert.equal(ranked[1].path, "test/webhook.test.js");
});

test("builds a pack with evidence links and an uncertainty warning", () => {
  const markdown = buildContextPack({
    repository: {
      full_name: "acme/widget",
      html_url: "https://github.com/acme/widget",
      default_branch: "main",
      license: { spdx_id: "MIT" },
    },
    issue: {
      number: 42,
      title: "Retry webhook delivery",
      html_url: "https://github.com/acme/widget/issues/42",
      body: "Retry transient failures.",
    },
    readme: "# Widget",
    rankedPaths: [{ path: "src/webhook.js", matchedTerms: ["webhook"] }],
    generatedAt: "2026-10-22T00:00:00.000Z",
  });

  assert.match(markdown, /#42 Retry webhook delivery/);
  assert.match(markdown, /blob\/main\/src\/webhook\.js/);
  assert.match(markdown, /not proof that all relevant context was found/);
});
