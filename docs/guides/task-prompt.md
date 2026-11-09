# Task prompt: one template for any AI assistant

The same prompt for every task, in two versions, with a few things to fill in by hand (§1):

- **§2** for an assistant that reads the repository and runs commands: Claude Code, or an editor
  agent such as GitHub Copilot agent mode or Codex ([`AGENTS.md`](../../AGENTS.md) sends them to
  [`CLAUDE.md`](../../CLAUDE.md));
- **§3** for a chat without access to the repository: claude.ai without Claude Code, or any other
  chat assistant.

Nothing in the project requires an AI assistant: without one, §5 applies.

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

## 3. The prompt — for a chat assistant (claude.ai, without Claude Code)

A chat cannot read the repository or run commands, so you give it the files and you run the
commands.

**Once, on claude.ai:** create a Project (for example "Anomaly Guard") and add these files of the
repository as project knowledge, so you never attach them again: `CLAUDE.md`,
`docs/statistics/methods.md`, `docs/planning/backlog.md`, and ADR-006 to ADR-010 from
`docs/development/adr/`. Download them from GitHub, or take them from your clone. Update them in
the Project when they change on `main`. With another chat assistant, attach them to the
conversation instead.

**For each task:** start a new conversation in the Project, attach the source and test files
listed for the task in §4, and paste this prompt, filled in as in §1:

```text
I am working on task <TASK> of The Anomaly Guard, theme <THEME>:
"<TASK ROW>"

You cannot read the repository or run commands: the project knowledge holds the rules
(CLAUDE.md), the methods, the backlog and the ADRs; the attached files are the code and tests
for this task. Follow CLAUDE.md.

1. Read CLAUDE.md, the task's row and checklist in the backlog, the ADRs and the methods.md
   sections it cites, and the attached files. If you need a file I have not attached, ask me
   for it by its path instead of guessing its content.
2. Before writing code, give me a plan in at most 10 lines: the functions and formulas, the
   tests with their known-answer values, and anything in the spec that is ambiguous. Wait for
   my OK.
3. Give me whole files, not fragments, each with its path, so that I can replace them as they
   are. Change only what this task needs.
4. Write the tests together with the code: known answers, edge cases, and monotonicity where
   it applies.
5. I will run npm test, npm run lint and npm run format:check and paste you the output: fix
   until they pass.
6. Give me the updated row of the task in docs/planning/backlog.md, and the methods.md
   changes if the method changed.
7. Finish with: the branch name feat/<task in lowercase>-<SHORT-NAME>, the commit message
   (Conventional Commits), a pull-request description that follows
   .github/pull_request_template.md, and five lines for my report chapter on what was done and
   which statistics it uses.

Explain every statistical choice in plain words: I must be able to defend all of it at the
exam.
```

Then, in your clone: create the branch, copy the files in, run the checks, commit and open the
pull request ([team guide](team-guide.md) §1.5). For B-01, do not add
`traffic/src/generators.js` to the Project or the conversation (§4).

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
