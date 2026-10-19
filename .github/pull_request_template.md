<!--
PR title in Conventional Commits form, e.g. `feat(stats): add chi-square character test`.
There is no CI gate (ADR-005): run the checks locally and report the real result below.
-->

## What & why

<!-- What changes and which problem it solves, in a few lines. -->

**Reference:** <!-- backlog task id (e.g. C-03), docs/project-brief.md section, or an ADR -->

## Checklist

- [ ] Scope: only what the brief / backlog task asks (no features invented on the side)
- [ ] Tests added or updated for the changed behaviour (`npm test`)
- [ ] `npm run lint` and `npm run format:check` pass locally
- [ ] Statistics: trained only on legitimate traffic, test set held out, no label leakage
- [ ] Docs updated (ADR / standards / methods / README) if a decision or rule changed
- [ ] Individual contribution noted for grading (who did what)

## Notes for the reviewer

<!-- Delicate points, choices to double-check, what to try by hand. Optional. -->
