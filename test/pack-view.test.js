import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderPack} from '../src/pack-view.js';
import {run} from '../src/cli.js';
const pack={version:1,generatedAt:'2026-11-02T00:00:00Z',source:{repositoryUrl:'https://github.com/synthetic/example',issueUrl:'https://github.com/synthetic/example/issues/1',defaultBranch:'main'},warnings:['<script>alert(1)</script>'],markdown:'<img src="https://example.invalid/pixel">\n# Synthetic'};
test('viewer escapes all evidence and exports exclusively without network',async()=>{
 const html=renderPack(pack);
 assert.doesNotMatch(html,/<script>|<img/);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/Content-Security-Policy/);
 assert.match(html,/tabindex="0"/);
 const dir=await mkdtemp(join(tmpdir(),'contextbridge-view-'));
 try{
  const source=join(dir,'pack.json'),output=join(dir,'view.html');await writeFile(source,JSON.stringify(pack));
  const client=new Proxy({}, {get(){throw new Error('must not fetch')}});
  assert.equal(await run(['view',source,output],client),0);
  const saved=await readFile(output,'utf8');assert.equal(saved,html);
  await assert.rejects(run(['view',source,output],client),/EEXIST/);
  assert.equal(await readFile(output,'utf8'),saved);
 }finally{await rm(dir,{recursive:true,force:true});}
});
