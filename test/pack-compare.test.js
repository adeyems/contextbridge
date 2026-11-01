import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPack, comparePacks } from '../src/pack-compare.js';
const pack=()=>({version:1,generatedAt:'2026-11-01T00:00:00Z',source:{issueUrl:'https://github.com/acme/widget/issues/1',repositoryUrl:'https://github.com/acme/widget',defaultBranch:'main'},warnings:[],markdown:'# Context pack: Synthetic\n\nGenerated: 2026-11-01T00:00:00Z\n\nSynthetic'});
test('comparison ignores only generation time and bounds change excerpts',()=>{
 const a=pack(),b=pack(); b.generatedAt='2026-11-02T00:00:00Z';b.markdown=b.markdown.replace(a.generatedAt,b.generatedAt);
 assert.equal(comparePacks(a,b).match,true);
 b.markdown+='\n'+('x'.repeat(600)+'\n').repeat(101);
 const report=comparePacks(a,b); assert.equal(report.match,false);assert.equal(report.changedRegion.truncated,true);assert.equal(report.changedRegion.added.length,100);
 b.source.issueUrl+='0';assert.throws(()=>comparePacks(a,b),/different/);
});
test('pack reader rejects invalid schema and oversized files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pack-compare-'));const file=join(dir,'p.json');
 try {await writeFile(file,JSON.stringify(pack()));assert.deepEqual(await loadPack(file),pack());
 for(const value of ['{}',' '.repeat(2*1024*1024+1)]) {await writeFile(file,value);await assert.rejects(loadPack(file));}
 }finally{await rm(dir,{recursive:true,force:true});}
});
