# ContextBridge

ContextBridge creates evidence-backed context packs for software-engineering
tasks. Give it a public GitHub issue URL and it gathers the task, repository
metadata, README, and relevant paths into a reviewable Markdown document.

The project is intentionally deterministic and local-first. It does not train,
evaluate, benchmark, or serve AI models. It helps developers and coding
assistants understand an existing task before changing code.

## Current capability

The first vertical slice can:

- parse and validate a public GitHub issue URL;
- retrieve public repository and issue metadata;
- retrieve the repository README and recursive file tree;
- rank likely relevant paths using weighted issue terms and explain each score;
- include recent commits for the strongest candidate paths;
- discover potentially related issues for human review;
- export a Markdown context pack with links back to its evidence; and
- run without an account or API key for low-volume public GitHub usage.

## Requirements

- Node.js 20 or newer
- Internet access to `api.github.com`

## Run it

```bash
npm test
node src/cli.js https://github.com/OWNER/REPOSITORY/issues/123
```

Write the result to a file:

```bash
node src/cli.js https://github.com/OWNER/REPOSITORY/issues/123 --output context-pack.md
```

GitHub applies a lower API limit to unauthenticated requests. You may provide a
fine-grained, read-only token through `GITHUB_TOKEN`; never commit the token.

## Privacy and scope

The CLI checks repository metadata before fetching issues or content and rejects
repositories not explicitly marked public. This is a check at retrieval time,
not a guarantee against later visibility changes. It does not send data to an AI
provider. It writes retrieved excerpts to stdout or the requested Markdown file.
Public GitHub responses and free text can contain personal information; the tool
does not detect or remove it. Use synthetic fixtures for programme development
until the organisers clarify whether the live-data scope is eligible. See
[Project safeguards](docs/project-safeguards.md).

Candidate paths require at least one matching issue term; source/test bonuses
only affect the order of matching paths. Optional README/history/search failures
and truncated trees or searches appear in a Retrieval status section. Such packs
can still be generated successfully, but need review for missing evidence.
Repository, issue and file-tree request failures stop generation.

## Roadmap

The substantial planned work is tracked in [ROADMAP.md](ROADMAP.md). The next
milestones cover local indexing, commit and pull-request evidence, review and
approval workflows, GitHub webhook synchronisation, exports, an MCP interface,
and production hardening.

## Development status

ContextBridge is an early working prototype. Retrieval is intentionally
conservative and its candidate paths and related issues require human review.
The fixture-backed test suite and CI workflow protect the current vertical
slice while the indexing approach evolves.

## Licence

[MIT](LICENSE)

