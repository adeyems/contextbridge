import test from 'node:test';
import assert from 'node:assert/strict';
import {rankMarkdownHeadings, buildWeightedTerms} from '../src/context-pack.js';
test('heading relevance keeps line evidence and excludes fenced code',()=>{
 const markdown='# Intro\n```js\n# webhook fake\n```\n## Retry webhook ###\n### Retry\n~~~\n# webhook fake\n~~~';
 const result=rankMarkdownHeadings(markdown,buildWeightedTerms('webhook','retry'));
 assert.deepEqual(result.headings.map(h=>[h.line,h.title,h.score]),[[5,'Retry webhook',4],[6,'Retry',1]]);
 assert.equal(result.inputClipped,false);
});
test('heading limits and stable ties are visible',()=>{
 const result=rankMarkdownHeadings(Array(20).fill('# webhook').join('\n'),buildWeightedTerms('webhook'));
 assert.equal(result.headings.length,12);assert.equal(result.matchesOmitted,8);
 assert.equal(result.headings[0].line,1);
 assert.equal(rankMarkdownHeadings('x'.repeat(65537),[]).inputClipped,true);
});
