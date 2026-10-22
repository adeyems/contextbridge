import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/github.js";

function response({ status = 200, json, text, remaining = "50" }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "x-ratelimit-remaining": remaining }),
    async json() { return json; },
    async text() { return text; },
  };
}

test("retrieves a README as raw text", async () => {
  const client = new GitHubClient({
    fetchImpl: async () => response({ text: "# Fixture repository" }),
  });

  assert.equal(await client.getReadme("acme", "widget"), "# Fixture repository");
});

test("reports exhausted GitHub rate limits clearly", async () => {
  const client = new GitHubClient({
    fetchImpl: async () => response({ status: 403, remaining: "0", json: {} }),
  });

  await assert.rejects(
    client.getRepository("acme", "widget"),
    /API rate limit is exhausted/,
  );
});

test("encodes path history requests without exposing a token in the URL", async () => {
  let requestedUrl;
  let requestedOptions;
  const client = new GitHubClient({
    token: "fixture-token",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return response({ json: [] });
    },
  });

  await client.getCommitsForPath("acme", "widget", "src/a file.js");
  assert.match(requestedUrl, /path=src%2Fa%20file\.js/);
  assert.doesNotMatch(requestedUrl, /fixture-token/);
  assert.equal(requestedOptions.headers.Authorization, "Bearer fixture-token");
});
