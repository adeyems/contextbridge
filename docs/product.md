# Product definition

## Problem

Developers often begin a change before discovering a relevant requirement,
decision, prior pull request, test or ownership constraint. Existing context is
spread across repository files and GitHub activity, and gathering it is mostly
manual.

## User

The initial user is an independent developer or small open-source maintainer
working in a public GitHub repository.

## Product promise

For a concrete engineering task, ContextBridge produces a compact, reviewable
pack of relevant context in which every claim links back to source evidence.

## Principles

1. Evidence before generation.
2. Human review before export.
3. Deterministic retrieval must work without an LLM.
4. Local storage and least-privilege access by default.
5. A context pack must show omissions and uncertainty, not hide them.

## Non-goals

- Training, evaluating, benchmarking or serving AI models.
- Acting as an autonomous coding agent.
- Processing customer, health, financial or other regulated personal data.
- Replacing GitHub issue tracking or source control.

