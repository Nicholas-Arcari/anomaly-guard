# Task prompt: one template for any AI assistant

The same prompt for every task and every tool: Claude Code, an editor agent that reads the
repository (GitHub Copilot agent mode, Codex — [`AGENTS.md`](../../AGENTS.md) sends them to
[`CLAUDE.md`](../../CLAUDE.md)), or a chat assistant such as claude.ai. You fill in three things by
hand. Nothing in the project requires an AI assistant: without one, §5 applies.

Three rules, whatever the tool:

- **One task per session.** A new session for each task (in Claude Code: `/clear` when the task
  is done). The assistant re-reads the whole conversation at every step, so a long session costs
  far more than several short ones.
- **You must be able to explain everything** the assistant writes: the grade is individual.
  The prompt asks for explanations; read them.
- **Say which tool you used** in the pull request's "individual contribution" line.

## 1. Fill in

| Placeholder    | Where to find it                                         | Example                                      |
| -------------- | -------------------------------------------------------- | -------------------------------------------- |
| `<TASK>`       | the task id in `docs/planning/backlog.md`                | `C-03`                                       |
| `<TASK ROW>`   | the text of that task's row, copied as it is             | `Chi-square score in stats/chisquare.js (…)` |
| `<THEME>`      | your theme in backlog §8                                 | `T1`                                         |
| `<SHORT-NAME>` | two to four words for the branch, lowercase with hyphens | `chi-square`                                 |

## 2. The prompt — for an assistant that reads the repository and runs commands

Claude Code, Copilot agent mode, Codex:

```text
I am working on task <TASK> of The Anomaly Guard, theme <THEME>:
"<TASK ROW>"

1. Read CLAUDE.md and follow it. Then read the task's row and checklist in
   docs/planning/backlog.md, the ADRs and the docs/statistics/methods.md sections it cites,
   and the files listed for <TASK> in docs/guides/task-prompt.md §4.
2. Before changing anything, give me a plan in at most 10 lines: the functions and formulas,
   the tests with their known-answer values, and anything in the spec that is ambiguous.
   Wait for my OK.
3. Work on a new branch feat/<task in lowercase>-<SHORT-NAME> from an up-to-date main. Touch
   only what this task needs.
4. Write the tests together with the code: known answers, edge cases, and monotonicity where
   it applies.
5. Run npm test, npm run lint and npm run format:check until they pass, and show me the real
   output.
6. Update the task's status in docs/planning/backlog.md, and methods.md if the method changed.
7. Finish with: the commit message (Conventional Commits), a pull-request description that
   follows .github/pull_request_template.md, and five lines for my report chapter on what was
   done and which statistics it uses.

Explain every statistical choice in plain words: I must be able to defend all of it at the
exam.
```

## 3. The same prompt for a chat assistant

A chat (claude.ai, or any other) cannot read the repository or run commands. Give it the files:

- **Once:** on claude.ai, create a Project and add `CLAUDE.md`, `docs/statistics/methods.md`,
  `docs/planning/backlog.md` and ADR-006 to ADR-010 (`docs/development/adr/`) as project
  knowledge, so you do not attach them every time. Elsewhere, attach them to the conversation.
- **For each task:** attach the source and test files listed for it in §4.

Use the prompt of §2 with these three steps in place of steps 1, 3 and 5:

```text
1. The attached files are the rules (CLAUDE.md) and the code for task <TASK>: follow the rules.
3. Give me whole files, not fragments, so that I can replace them as they are.
5. You cannot run commands: I will run npm test, npm run lint and npm run format:check and
   paste you the output. Fix until they pass.
```

You then create the branch, copy the files in, run the checks and open the pull request yourself
([team guide](team-guide.md) §1.5).

## 4. Files for each task

Paths are under `packages/`.

| Task             | Theme  | Source and tests                                                                                                                                           | Read                                                                                                                             |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| C-03             | T1     | `core/src/stats/chisquare.js`, a new `core/test/chisquare.test.js`; `core/src/stats/model.js`, `core/src/features/extract.js`, `core/src/stats/entropy.js` | methods §0, §4; ADR-008                                                                                                          |
| C-08             | T1     | `core/src/stats/chisquare.js`, `core/src/stats/entropy.js`                                                                                                 | methods §1, §4b; ADR-008                                                                                                         |
| B-01             | T1     | `core/src/rules/engine.js`, `core/test/rules.test.js`                                                                                                      | ADR-006. **Do not open `traffic/src/generators.js`**: the rules must be written without seeing the obfuscated and novel payloads |
| C-04             | T2     | `core/src/stats/length.js`, `core/test/length.test.js`, `core/src/stats/model.js`                                                                          | methods §3; ADR-007                                                                                                              |
| C-05             | T2     | a new `core/src/stats/outliers.js` with its test; `core/src/stats/model.js`                                                                                | methods §5; ADR-007                                                                                                              |
| C-06             | T2     | `core/src/stats/anomaly.js`, `core/test/anomaly.test.js`, and the signal files                                                                             | methods §0; ADR-007                                                                                                              |
| C-07             | T2     | `core/src/detector/detect.js`, `core/test/detect.test.js`                                                                                                  | ADR-007                                                                                                                          |
| D-03             | T3     | `evaluation/src/index.js` (`rocCurve`), `evaluation/test/metrics.test.js`                                                                                  | methods §6; ADR-004                                                                                                              |
| D-05, D-06       | T3     | `evaluation/src/index.js` (new `wilsonInterval`, bootstrap, `thresholdAtFpr`), `evaluation/test/metrics.test.js`                                           | methods §6; ADR-009                                                                                                              |
| D-04             | T3     | a new workspace `experiments/`                                                                                                                             | ADR-009; `docs/development/project-structure.md` §2                                                                              |
| B-02             | T3     | `server/src/server.js`                                                                                                                                     | ADR-009                                                                                                                          |
| E-02 (ROC), E-06 | T3     | `dashboard/evaluation.html`, `dashboard/src/pages/evaluation.js`, `dashboard/src/charts.js`                                                                | dashboard README, "Adding your theme's chart"; ADR-010                                                                           |
| A-02 – A-05      | T4     | `traffic/src/generators.js`, `traffic/src/dataset.js`, `traffic/src/rng.js`, `traffic/test/*.test.js`                                                      | the A-02 and A-04 checklists in the backlog; ADR-006                                                                             |
| E-03             | T4     | `dashboard/base-rate.html`, a new `dashboard/src/pages/base-rate.js`, `dashboard/src/charts.js`                                                            | methods §7; dashboard README                                                                                                     |
| E-02 (T1, T2)    | T1, T2 | `dashboard/models.html`, `dashboard/src/pages/models.js`, `dashboard/src/charts.js`                                                                        | dashboard README; ADR-010                                                                                                        |

## 5. Without an AI assistant

Everything above works by hand: the task's row and the methods section are the specification,
the tests tell you when it works, and the [team guide](team-guide.md) §1.5 is the workflow.
