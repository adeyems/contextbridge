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
- rank likely relevant paths using terms from the issue;
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

The current version accepts public repositories only. It does not persist
repository contents, transmit them to an AI provider, or process customer or
regulated personal data. See [Project safeguards](docs/project-safeguards.md).

## Roadmap

The substantial planned work is tracked in [ROADMAP.md](ROADMAP.md). The next
milestones cover local indexing, commit and pull-request evidence, review and
approval workflows, GitHub webhook synchronisation, exports, an MCP interface,
and production hardening.

## Licence

[MIT](LICENSE)

