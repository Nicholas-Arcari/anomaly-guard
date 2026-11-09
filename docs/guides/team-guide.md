# Team guide: access, portfolio, live demo

Step-by-step instructions for the members of the group, with the commands to run.

- **Part 1** gets you into the repository and working on your theme.
- **Part 2** shows the live demo in **your own portfolio website on GitHub Pages** (not your GitHub
  profile page), without copying any code into it.
- **Part 3** is how visitors use the demo from inside your portfolio.

Repository: <https://github.com/Nicholas-Arcari/anomaly-guard> · Live demo:
<https://nicholas-arcari.github.io/anomaly-guard/>

## Part 1 — Access the repository and work on it

### 1.1 The owner invites you (repository owner only)

On GitHub: **Settings → Collaborators → Add people**, your teammate's username, role **Write**. Or
from a terminal, once per teammate:

```bash
gh api -X PUT repos/Nicholas-Arcari/anomaly-guard/collaborators/<their-github-username> -f permission=push
```

_Write_ lets them push branches and open pull requests; it does not let them change the
repository's settings.

### 1.2 Accept the invitation

Open <https://github.com/Nicholas-Arcari/anomaly-guard/invitations> (or the e-mail from GitHub) and
accept. Until then you can read the public repository but not push to it.

### 1.3 Install the tools (once)

You need Git, Node.js 22 or later and the GitHub CLI (`gh`), all free:

| System               | Commands                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Windows              | `winget install --id Git.Git` · `winget install --id OpenJS.NodeJS.LTS` · `winget install --id GitHub.cli` |
| macOS                | `brew install git node gh`                                                                                 |
| Debian, Ubuntu, Kali | `sudo apt install git gh`, and Node.js 22 from <https://nodejs.org> (the distribution's one may be older)  |

```bash
git --version     # any recent version
node --version    # v22 or later
gh --version      # any recent version
```

### 1.4 Get the code and run the setup (once per computer)

```bash
git clone https://github.com/Nicholas-Arcari/anomaly-guard.git
cd anomaly-guard
npm install          # installs every workspace
npm run team-setup   # your e-mail stays private (see below)
npm test             # every test must pass
npm run dev          # the dashboard at http://localhost:5173/ (Ctrl+C to stop)
```

The repository is public, so every commit e-mail is public too. `npm run team-setup` is the same
command for everyone, the owner included; it uses your own GitHub login, so it changes only your
own account and your own git settings:

1. it logs you in to GitHub through the browser (or adds the permission it needs to an existing
   login);
2. it makes your e-mail private on GitHub — the **Keep my email addresses private** setting;
3. it makes git sign your commits with your GitHub noreply address
   (`12345678+your-username@users.noreply.github.com`) instead of your personal e-mail, asking
   before it changes your global git settings;
4. it turns on a check in your clone that refuses any commit carrying another address;
5. it accepts your invitation to the repository, if one is pending.

It prints every change; `npm run team-setup -- --dry-run` only shows the plan. Running it again
is safe. Everything it uses is free: the GitHub API is the same thing the website does, available
to every account. One setting has no API: open <https://github.com/settings/emails> and tick
**Block command line pushes that expose my email** — GitHub then refuses a push that would
publish your personal address, whatever computer you use.

Then read [`CLAUDE.md`](../../CLAUDE.md) (the rules, ten minutes), ADR-006 to ADR-010 in
[`docs/development/adr/`](../development/adr/README.md), and your theme in
[`docs/planning/backlog.md`](../planning/backlog.md) §8 — and write your name next to it.

### 1.5 Work on a task: one task, one branch, one pull request

```bash
git switch main && git pull                   # start from the latest main
git switch -c feat/c-03-chi-square            # <type>/<task-id>-<short-description>
# … write the code and its tests …
npm test && npm run lint && npm run format:check
git add -A
git commit -m "feat(stats): add the chi-square character score"
git push -u origin feat/c-03-chi-square
gh pr create --fill                           # or open the pull request on github.com
```

In the pull request, fill in the template: what and why, the checks you ran, your contribution.
Update your task's status in `docs/planning/backlog.md` in the same pull request. After a
teammate's review, merge it on GitHub and delete the branch. The dashboard has its own notes for
adding your theme's chart: [`packages/dashboard/README.md`](../../packages/dashboard/README.md).

Working with an AI assistant — Claude Code, an editor agent or a chat — or with none: one
prompt for every task, with the files each task needs, in [`task-prompt.md`](task-prompt.md).

## Part 2 — Show the live demo in your portfolio

The demo is published once, from this repository. Your portfolio only **points to it**: no code is
copied, and every portfolio shows the latest version as soon as the repository republishes it.

### 2.1 Choose what to show

Any page, with any settings, is a plain address:

| Address                                                           | Shows              |
| ----------------------------------------------------------------- | ------------------ |
| `https://nicholas-arcari.github.io/anomaly-guard/`                | Overview           |
| `https://nicholas-arcari.github.io/anomaly-guard/events.html`     | Security events    |
| `https://nicholas-arcari.github.io/anomaly-guard/rules.html`      | Rules              |
| `https://nicholas-arcari.github.io/anomaly-guard/models.html`     | Statistical models |
| `https://nicholas-arcari.github.io/anomaly-guard/evaluation.html` | Detection quality  |
| `https://nicholas-arcari.github.io/anomaly-guard/base-rate.html`  | Base rate          |
| `https://nicholas-arcari.github.io/anomaly-guard/about.html`      | About the project  |

Add settings to open a specific experiment, for example
`…/events.html?seed=7&mode=stats&threshold=2&prevalence=0.1&size=1000&show=mistakes`.

### 2.2 Option A — a link (works everywhere)

```html
<a href="https://nicholas-arcari.github.io/anomaly-guard/" target="_blank" rel="noopener noreferrer"
  >The Anomaly Guard — live demo</a
>
```

### 2.3 Option B — the demo inside your page

Plain HTML (also Jekyll, Hugo and similar):

```html
<iframe
  class="anomaly-guard-demo"
  src="https://nicholas-arcari.github.io/anomaly-guard/"
  title="The Anomaly Guard — live demo"
  loading="lazy"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
></iframe>
```

React (JSX):

```jsx
<iframe
  className="anomaly-guard-demo"
  src="https://nicholas-arcari.github.io/anomaly-guard/"
  title="The Anomaly Guard — live demo"
  loading="lazy"
  referrerPolicy="no-referrer"
  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
/>
```

And in your stylesheet (a class rather than a `style` attribute, so it also works with a strict
Content Security Policy):

```css
.anomaly-guard-demo {
  width: 100%;
  height: 80vh;
  min-height: 640px;
  border: 0;
  border-radius: 8px;
}
```

Why these attributes:

- **`sandbox` without `allow-same-origin`**: the demo runs isolated from your site and cannot read
  your page, cookies or storage. It needs nothing more: settings and navigation work inside the
  sandbox.
- **`allow-popups allow-popups-to-escape-sandbox`**: the "Source code" links open GitHub in a new
  tab.
- **`loading="lazy"`**: the demo loads only when the visitor scrolls to it.
- Keep the height at 640 px or more. Below 900 px of width the demo switches to a compact layout
  with a menu button.

### 2.4 If your site has a Content Security Policy

Many sites set none: then skip this step. To find out, search your portfolio's code:

```bash
grep -rn "Content-Security-Policy" --include=*.html --include=*.js --include=*.jsx --include=*.ts . | grep -v node_modules
```

If it sets one, the frame stays blank until the policy allows the demo's address. Add this
directive to the existing policy, or replace an existing `frame-src` (for example
`frame-src 'none'`) with it, and leave the rest unchanged:

```text
frame-src https://nicholas-arcari.github.io/anomaly-guard/
```

### 2.5 Publish your portfolio

Use the way your portfolio is already published:

- **User site** (a repository named `<username>.github.io`, published from a branch):

  ```bash
  git add -A
  git commit -m "feat: show The Anomaly Guard live demo"
  git push
  ```

- **Vite or React with the `gh-pages` package** (a `deploy` script in `package.json`): commit and
  push as above, then

  ```bash
  npm run deploy       # usually: npm run build && gh-pages -d dist
  ```

- **GitHub Actions** (a workflow in `.github/workflows/`): commit and push; the workflow deploys.

GitHub Pages updates within a few minutes.

### 2.6 Check it

Open your portfolio page and reload it without the cache (Ctrl+Shift+R). The frame must show the
Overview with its numbers and charts. If it does not, see [Troubleshooting](#troubleshooting).

## Part 3 — Using the demo from your portfolio

Visitors use the demo inside your page exactly as on its own site:

1. **Settings bar** (at the top): seed, detector (rules + statistics, statistics only, rules only),
   threshold, attack share, number of requests, then **Apply**. The same seed always gives the
   same traffic.
2. **Sidebar**: moves between the pages. In a narrow frame, open it with the ☰ button.
3. **Security events**: filter with the tabs (alerts, not flagged, detector mistakes) and open a
   row to see the request, its scores, the reason for the verdict and the full record.
4. **Source code ↗** opens the repository in a new tab.

Everything runs in the visitor's browser: no request leaves it and no payload is ever executed.

## Troubleshooting

| What you see                                                                | Cause                                    | Fix                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Blank frame; the browser console says "Refused to frame … `frame-src` …"    | your site's Content Security Policy      | step 2.4                                               |
| Blank frame; the console mentions `X-Frame-Options` or "refused to connect" | the address points to github.com         | use `https://nicholas-arcari.github.io/anomaly-guard/` |
| "404" inside the frame                                                      | a typo in the page name                  | open the address in a new tab and correct it           |
| An old version                                                              | browser or GitHub Pages cache (≤ 10 min) | wait, then reload without the cache                    |
| "Source code" does nothing                                                  | the sandbox does not allow new tabs      | add `allow-popups allow-popups-to-escape-sandbox`      |

## For the repository owner: republishing the demo

After merging changes to the dashboard into `main`, publish again with the commands in
[`packages/dashboard/README.md`](../../packages/dashboard/README.md#publish-to-github-pages-manual--no-ci-adr-005).
Every portfolio shows the new version within minutes; nothing changes on their side.
