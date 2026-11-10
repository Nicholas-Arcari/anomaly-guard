# ADR-001: Scope and educational boundaries (simulation only)

**Date:** 2026-10-19
**Status:** Accepted
**Author:** The Anomaly Guard team

## Context

The brief asks for an IDS that monitors "simulated web requests" and is evaluated with
"legitimate and simulated malicious requests". An IDS topic can drift toward handling real
traffic or real attacks; that would be out of scope, harder to make reproducible, and
inappropriate for a coursework prototype. We need an explicit boundary everyone (and every AI
assistant) can apply without re-deciding each time.

## Decision

The system is a **closed, offline experiment**:

- All traffic is **generated locally** by `packages/traffic` from an explicit seed. We do not
  capture a real network, proxy real traffic, or send requests to any real host.
- Malicious samples are standard, public, well-known example strings (e.g. a textbook
  `' OR '1'='1`), used only as **measurement subjects** for the detector.
- **No payload is ever executed, interpreted, requested, or rendered.** The detector only
  measures strings (length, character counts, entropy, regex match). No `eval`, `new Function`,
  shell, real SQL, DOM-as-HTML, or outbound request anywhere in the code.
- The Express server binds to `localhost` and exists to demonstrate the ingest/analyse loop; it
  is not exposed.

If a task appears to need anything beyond this, the contributor stops and asks.

## Alternatives considered

| Alternative                                           | Why rejected                                                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture real HTTP traffic (proxy / pcap)              | Out of scope, not reproducible, privacy and safety concerns for coursework                                                                                                             |
| Replay a public attack dataset (e.g. CSIC, HTTP logs) | Reasonable, but a seeded generator lets us control prevalence and craft the "hard cases" and novel attacks the brief needs; a real dataset can be added later as an ADR if time allows |
| Build a usable real-world IDS                         | The brief asks for a simplified educational prototype and an honest evaluation, not a product                                                                                          |

## Consequences

### Positive

- The boundary is unambiguous and safe; reviewers and assistants apply it mechanically.
- Reproducibility: a seed reproduces the whole dataset and every reported number.
- We control attack prevalence, which is exactly what the base-rate discussion needs.

### Negative / risks

- Synthetic traffic may be easier to separate than real traffic; we mitigate by deliberately
  including obfuscated / mimicry attacks and legitimate-but-weird inputs, and we state this
  limitation in the report.

### Actions

- [x] State the boundary in `AGENTS.md` §2 and `standards.md` §5.
- [ ] Keep a committed fixture set of "hard cases" for tests.
