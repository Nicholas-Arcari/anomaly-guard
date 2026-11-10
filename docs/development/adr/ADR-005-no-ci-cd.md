# ADR-005: No CI/CD; local checks only

**Date:** 2026-10-19
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

Other repositories in this account use a full automated gate (GitHub Actions CI, Dependabot,
CodeQL, branch rulesets, heavy pre-commit). For this coursework prototype that apparatus was
**explicitly excluded**. The repository is private and small, the team is 3–5 people, and the
deliverable is an experiment plus a report, not a continuously deployed service.

## Decision

- **No CI/CD.** No `.github/workflows/`, no Dependabot, no CodeQL, no branch rulesets, no
  automated deploy.
- Quality checks are run **locally** and reported in the PR: `npm test`, `npm run lint`,
  `npm run format:check`, and `npm run build` for dashboard changes.
- The PR template reminds the author to run them and to note their individual contribution.
- GitHub Pages is published **manually** (`npm run build`, then push `dist/` to a `gh-pages`
  branch).

## Alternatives considered

| Alternative                                 | Why rejected                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Full CI gate (as the account's other repos) | Explicitly out of scope for this project; disproportionate for coursework                                                        |
| A single minimal "npm test" workflow        | Low cost and tempting, but the instruction was to exclude CI/CD; it can be added later with a follow-up ADR if the team wants it |
| Auto-deploy to Pages via Actions            | Same — omitted deliberately; manual publish is enough for a demo                                                                 |

## Consequences

### Positive

- Nothing to configure or pay for; no billing surprises on a private repo.
- Simpler repository; focus stays on the statistics and the report.

### Negative / risks

- Checks are honour-system: a contributor can push code that fails tests. Mitigated by small PRs,
  the PR checklist, and reviewing each other's PRs.
- No automated dependency/security updates. Acceptable for a short-lived coursework repo with a
  tiny dependency surface.

### Actions

- [x] No workflow files in the repository.
- [x] Document the local checks in `AGENTS.md` §9 and `standards.md` §7.
- [ ] If the team later wants a minimal `npm test` workflow, supersede this ADR.
