# Roadmap

ContextBridge has a working command-line vertical slice. The following work is
planned but not yet implemented. Estimates are deliberately coarse and will be
revised as the product is used.

## Milestone 1: stronger retrieval (12-18 hours)

- Completed foundation: weighted filename ranking with human-readable reasons.
- Completed foundation: recent path commits and related-issue candidates.
- Parse source symbols with Tree-sitter.
- Index Markdown headings, source symbols and test names locally.
- Add BM25 ranking and explain every relevance score.
- Add pull-request evidence and improve commit relevance beyond recency.
- Detect renamed and deleted files when following historical evidence.

## Milestone 2: review workflow (10-16 hours)

- Add a web interface for reviewing generated packs.
- Approve, reject and annotate individual evidence items.
- Version context packs and show changes between revisions.
- Add explicit unanswered-question and risk sections.
- Export stable Markdown and JSON schemas.

## Milestone 3: repository synchronisation (10-15 hours)

- Support GitHub App installation with least-privilege permissions.
- Process webhook events with idempotency and retry handling.
- Perform incremental indexing after pushes and issue updates.
- Surface rate-limit state and synchronisation failures.

## Milestone 4: developer integrations (8-14 hours)

- Add an MCP server exposing approved context packs.
- Add exporters for repository instruction files.
- Add a pull-request check that links changes back to approved evidence.
- Provide Docker-based local deployment and backup documentation.

## Milestone 5: quality and operations (8-12 hours)

- Add end-to-end tests against recorded GitHub fixtures.
- Add accessibility and keyboard-navigation testing.
- Add structured logs, metrics and job tracing.
- Add load, failure-recovery and migration tests.
- Publish contributor and deployment documentation.

The unimplemented roadmap represents substantially more than 20 hours of
planned software-engineering work across features, tests, refactors,
documentation and deployment.

