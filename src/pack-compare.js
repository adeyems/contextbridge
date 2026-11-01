import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function loadPack(path) {
  const file = await open(path, 'r');
  try {
    const data = Buffer.alloc(2 * 1024 * 1024 + 1);
    let size = 0;
    while (size < data.length) {
      const { bytesRead } = await file.read(data, size, data.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size === data.length) throw new Error('Pack exceeds 2 MiB');
    const pack = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(data.subarray(0,size)));
    if (!pack || Object.keys(pack).sort().join(',') !== 'generatedAt,markdown,source,version,warnings' || pack.version !== 1 ||
        typeof pack.generatedAt !== 'string' || !Number.isFinite(Date.parse(pack.generatedAt)) || typeof pack.markdown !== 'string' ||
        !pack.source || Object.keys(pack.source).sort().join(',') !== 'defaultBranch,issueUrl,repositoryUrl' ||
        Object.values(pack.source).some(v=>typeof v !== 'string') || !Array.isArray(pack.warnings) || pack.warnings.some(v=>typeof v !== 'string')) {
      throw new Error('Invalid version-1 context pack');
    }
    return pack;
  } finally { await file.close(); }
}

export function comparePacks(before, after) {
  if (before.source.issueUrl !== after.source.issueUrl || before.source.repositoryUrl !== after.source.repositoryUrl) {
    throw new Error('Cannot compare packs from different issues or repositories');
  }
  // Ignore only the generator's timestamp line, not arbitrary dates in evidence.
  const normalize = pack => {
    const lines = pack.markdown.split('\n');
    if (lines[0]?.startsWith('# Context pack: ') && lines[1] === '' && lines[2] === `Generated: ${pack.generatedAt}`) lines[2] = 'Generated: [ignored]';
    return lines.join('\n');
  };
  const left = normalize(before), right = normalize(after);
  const oldLines=left.split('\n'), newLines=right.split('\n');
  let start=0, end=0;
  while(start<oldLines.length && start<newLines.length && oldLines[start]===newLines[start]) start++;
  while(end<oldLines.length-start && end<newLines.length-start && oldLines[oldLines.length-1-end]===newLines[newLines.length-1-end]) end++;
  const removed=oldLines.slice(start,oldLines.length-end), added=newLines.slice(start,newLines.length-end);
  const bound=lines=>lines.slice(0,100).map(line=>line.slice(0,500));
  const warningsChanged=JSON.stringify(before.warnings)!==JSON.stringify(after.warnings);
  const branchChanged=before.source.defaultBranch!==after.source.defaultBranch;
  return {version:1,match:left===right && !warningsChanged && !branchChanged,
    generatedAtIgnored:true, warningsChanged, branchChanged,
    baselineSha256:createHash('sha256').update(left).digest('hex'), candidateSha256:createHash('sha256').update(right).digest('hex'),
    changedRegion:{startLine:start+1,removed:bound(removed),added:bound(added),
      truncated:removed.length>100 || added.length>100 || [...removed,...added].some(line=>line.length>500)}};
}
