export function renderPack(pack) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
    '<title>ContextBridge pack review</title><style>body{font:16px system-ui;max-width:72rem;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ccc;padding:1rem}dt{font-weight:bold}dd{margin:0 0 1rem;overflow-wrap:anywhere}a{color:#174ea6}</style>' +
    '<h1>ContextBridge pack review</h1><p>Read-only local view. Evidence is displayed as literal text; links and embedded markup are not executed.</p>' +
    '<nav aria-label="Pack sections"><a href="#warnings">Retrieval warnings</a> · <a href="#evidence">Evidence text</a></nav>' +
    `<dl><dt>Repository</dt><dd>${escape(pack.source.repositoryUrl)}</dd><dt>Issue</dt><dd>${escape(pack.source.issueUrl)}</dd><dt>Branch</dt><dd>${escape(pack.source.defaultBranch)}</dd><dt>Generated</dt><dd>${escape(pack.generatedAt)}</dd></dl>` +
    '<h2 id="warnings">Retrieval warnings</h2>' +
    (pack.warnings.length ? `<ul>${pack.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul>` : '<p>No warnings recorded. This does not prove complete coverage.</p>') +
    `<h2 id="evidence">Evidence text</h2><pre tabindex="0">${escape(pack.markdown)}</pre></html>`;
}
