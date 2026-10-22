# Project safeguards

These safeguards keep the project suitable for public development and make the
repository's claims easy to verify.

## Ownership

- Development must use personally owned time, equipment and accounts.
- Do not copy employer, client, university or NDA-protected code or knowledge.
- Record any future co-owner or organisational ownership change before further
  programme submission or certification.

## Repository integrity

- Preserve genuine commit history; do not rewrite it to manufacture activity.
- Make commits using an email associated with the repository owner's GitHub
  account.
- Keep the repository public with the MIT licence at its root.
- Track future work in public issues and this roadmap.

## Data and secrets

- Use public GitHub data and made-up fixtures only.
- Never commit tokens, credentials, private keys, `.env` files or real customer
  data.
- Revoke and remove any credential accidentally committed before publication.
- Keep authenticated GitHub access optional, read-only and least-privileged.

## Product boundary

- Do not add model training, fine-tuning, evaluation, benchmarking, inference,
  serving or machine-learning infrastructure.
- The tool may export context for a developer or coding assistant, but it must
  remain useful without an AI model.
- Do not add offensive security or vulnerability-exploitation capabilities.

