import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadReviewNotes, run } from '../src/cli.js';
import { buildContextPack } from '../src/context-pack.js';

test('bounded author notes validate before network access', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'contextbridge-notes-'));
 try {
  const file = join(dir, 'notes.json');
  const notes = {version:1, questions:['Which tests apply?'], risks:['<script>']};
  await writeFile(file, JSON.stringify(notes));
  assert.deepEqual(await loadReviewNotes(file),notes);
  for (const value of [' '.repeat(16385), JSON.stringify({...notes,risks:['bad\nline']}), '{}']) {
   await writeFile(file,value);
   await assert.rejects(run(['https://github.com/acme/widget/issues/1','--review-notes',file], {getRepository(){ assert.fail('network must not run'); }}));
  }
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('notes are labelled author supplied and escape markup', () => {
 const pack=buildContextPack({repository:{html_url:'https://github.com/acme/widget',default_branch:'main',full_name:'acme/widget'},issue:{title:'Synthetic',number:1},rankedPaths:[],generatedAt:'fixed',reviewNotes:{questions:['[link](https://example.com)'],risks:['<script>']}});
 assert.match(pack,/Unanswered questions \(author supplied\)/);
 assert.match(pack,/&lt;script&gt;/);
 assert.ok(!pack.includes('[link](https://example.com)'));
});
