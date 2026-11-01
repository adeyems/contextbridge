import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GitHubClient } from '../src/github.js';
import { run } from '../src/cli.js';
import repository from './fixtures/github/repository.json' with { type: 'json' };
import issue from './fixtures/github/issue.json' with { type: 'json' };
import tree from './fixtures/github/tree.json' with { type: 'json' };

// Synthetic transport fixtures exercise the real adapter and CLI orchestration.
// Unknown requests fail the test; no request can fall back to the network.
test('fixture transport -> exported pack -> actual offline comparison CLI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'contextbridge-e2e-'));
  const requests = [];
  let partial = false;
  const client = new GitHubClient({token: '', fetchImpl: async (url, options) => {
    const target = new URL(url);
    requests.push(target);
    assert.equal(target.origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, undefined);
    const path = target.pathname;
    if (path === '/repos/acme/widget') return Response.json(repository);
    if (path === '/repos/acme/widget/issues/42') return Response.json(issue);
    if (path === '/repos/acme/widget/readme') {
      assert.equal(options.headers.Accept, 'application/vnd.github.raw+json');
      return new Response('# Synthetic webhook project');
    }
    if (path === '/repos/acme/widget/git/trees/main') {
      assert.equal(target.searchParams.get('recursive'), '1');
      return Response.json(tree);
    }
    if (path === '/repos/acme/widget/commits') {
      assert.ok(tree.tree.some(item => item.path === target.searchParams.get('path')));
      assert.equal(target.searchParams.get('per_page'), '3');
      return Response.json([]);
    }
    if (path === '/search/issues') {
      assert.match(target.searchParams.get('q'), /^repo:acme\/widget is:issue/);
      return partial ? new Response('synthetic private failure detail', {status: 403, headers: {'x-ratelimit-remaining':'0'}}) : Response.json({items:[]});
    }
    assert.fail(`Unexpected fixture request ${url}`);
  }});
  try {
    const a = join(directory, 'a.json'), b = join(directory, 'b.json');
    const exportPack = path => run(['https://github.com/acme/widget/issues/42', '--format', 'json', '--output', path], client);
    await exportPack(a);
    await exportPack(b);
    const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
    const compare = () => spawnSync(process.execPath, [cli, 'compare', a, b], {encoding:'utf8', env:{...process.env, GITHUB_TOKEN:''}});
    let result = compare();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).match, true);
    assert.ok(requests.length >= 10);
    partial = true;
    await exportPack(b);
    const pack = JSON.parse(await readFile(b, 'utf8'));
    assert.ok(pack.warnings.some(w => w.includes('Related-issue retrieval failed')));
    assert.doesNotMatch(pack.markdown, /synthetic private failure detail/);
    result = compare();
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).match, false);
  } finally { await rm(directory, {recursive:true, force:true}); }
});
