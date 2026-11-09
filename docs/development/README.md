# Development documentation — The Anomaly Guard

These documents hold the rules and decisions that govern how the project is built. They are
**binding** for everyone who contributes, people and AI assistants alike. The short, binding
summary is [`../../CLAUDE.md`](../../CLAUDE.md); these files are the detail behind it.

## Index

| Document                                               | Contents                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [`standards.md`](standards.md)                         | Code, statistics, data, git and documentation standards (MUST / SHOULD)                 |
| [`project-structure.md`](project-structure.md)         | Repository layout, workspaces, dependency rules, which theme works where                |
| [`tech-stack.md`](tech-stack.md)                       | The closed list of allowed technologies, with versions and rationale                    |
| [`adr/`](adr/README.md)                                | Architectural Decision Records: every significant choice, with context and consequences |
| [`../statistics/methods.md`](../statistics/methods.md) | The statistical methods and their formulas                                              |
| [`../planning/backlog.md`](../planning/backlog.md)     | Task board: tasks, dependencies, status, the work split by statistical theme            |
| [`../project-brief.md`](../project-brief.md)           | The assignment — defines the scope                                                      |

## Rules of use

1. **Read before you write.** Before touching an area, read the ADRs and standards that cover it.
2. **No new technology without an ADR.** A library or tool not listed in
   [`tech-stack.md`](tech-stack.md) needs an accepted ADR first.
3. **Decisions get recorded.** A choice that changes architecture, the detection method, or the
   evaluation methodology becomes an ADR.
4. **Docs follow the code.** A change that alters documented behaviour or a rule updates the docs
   in the same PR.

## Language

- Documentation: **English** (default). `README.it.md` and the final report may be Italian.
- Code, identifiers, comments, commit messages: **English**.
