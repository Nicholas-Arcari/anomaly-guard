// One command for every member of the group, the repository owner included, once per computer,
// from the repository root:
//
//   npm run team-setup                 (npm run team-setup -- --dry-run: only print the plan)
//
// The repository is public, so every commit e-mail is public too. After this script:
//   1. your GitHub account keeps your e-mail private ("Keep my email addresses private");
//   2. git signs your commits with your GitHub noreply address, not your personal e-mail;
//   3. this clone refuses a commit that would expose another address (.githooks/pre-commit);
//   4. a pending invitation to the repository, or to the organization that owns it, is accepted,
//      so you can push branches.
// It works through the GitHub CLI (gh) with YOUR login, so it changes only your own account and
// your own git settings. It prints every change, asks before touching your global git settings,
// and skips what is already done, so it is safe to run again. Team guide: docs/guides/team-guide.md.

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const DRY_RUN = process.argv.includes('--dry-run');
const ASSUME_YES = process.argv.includes('--yes');
const INTERACTIVE = Boolean(process.stdin.isTTY);

/**
 * Run a command. Returns its trimmed output; when it fails, returns null if `optional`, else
 * throws. `browser` steps hand the terminal to the command (gh opens a browser for the login).
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ optional?: boolean, browser?: boolean }} [options]
 */
function run(cmd, args, { optional = false, browser = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: browser ? 'inherit' : 'pipe' });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    const why = result.error ? result.error.message : (result.stderr ?? '').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed${why ? `: ${why}` : ''}`);
  }
  return browser ? '' : result.stdout.trim();
}

/** A change: always printed, made only outside a dry run. */
function change(description, action) {
  console.log(`  → ${description}${DRY_RUN ? ' (dry run: not done)' : ''}`);
  if (!DRY_RUN) action();
}

/** A step that needs the browser: only possible from a terminal. */
function browserStep(description, args) {
  if (!DRY_RUN && !INTERACTIVE) {
    fail(`${description} needs your browser: run "npm run team-setup" in a terminal.`);
  }
  change(description, () => run('gh', args, { browser: true }));
}

/** @param {string} question */
async function confirm(question) {
  if (ASSUME_YES || DRY_RUN) return true;
  if (!INTERACTIVE) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`  ${question} [Y/n] `)).trim().toLowerCase();
  rl.close();
  return answer === '' || answer.startsWith('y') || answer.startsWith('s');
}

const ok = (text) => console.log(`  ✓ ${text}`);
const step = (n, text) => console.log(`\n${n}/5  ${text}`);

/** @param {string} text */
function fail(text) {
  console.error(`\n✗ ${text}`);
  process.exit(1);
}

async function main() {
  step(1, 'Tools');
  if (run('git', ['--version'], { optional: true }) === null) {
    fail('git is not installed: https://git-scm.com/downloads');
  }
  if (run('gh', ['--version'], { optional: true }) === null) {
    fail(
      'the GitHub CLI (gh) is not installed: https://cli.github.com/ — Windows: winget install ' +
        '--id GitHub.cli · macOS: brew install gh · Debian, Ubuntu, Kali: sudo apt install gh. ' +
        'Then run "npm run team-setup" again.',
    );
  }
  ok('git and gh are installed');

  step(2, 'GitHub login');
  if (run('gh', ['api', 'user'], { optional: true }) === null) {
    browserStep('log in to GitHub (with the "user" permission, to make your e-mail private)', [
      'auth',
      'login',
      '--hostname',
      'github.com',
      '--git-protocol',
      'https',
      '--web',
      '--scopes',
      'user',
    ]);
    if (DRY_RUN) return finish(null);
  }
  if (run('gh', ['api', 'user/emails'], { optional: true }) === null) {
    browserStep('add the "user" permission to your GitHub login', [
      'auth',
      'refresh',
      '--hostname',
      'github.com',
      '--scopes',
      'user',
    ]);
  }
  const me = JSON.parse(run('gh', ['api', 'user']) ?? '{}');
  const noreply = `${me.id}+${me.login}@users.noreply.github.com`;
  ok(`logged in as ${me.login}; your noreply address is ${noreply}`);
  if (!DRY_RUN) run('gh', ['auth', 'setup-git'], { optional: true }); // git push uses this login

  step(3, 'E-mail privacy on GitHub');
  const emails = run('gh', ['api', 'user/emails'], { optional: true });
  const primary = emails === null ? null : JSON.parse(emails).find((e) => e.primary);
  if (primary?.visibility === 'private') ok('your e-mail is already private');
  else {
    change('make your e-mail private ("Keep my email addresses private")', () =>
      run('gh', ['api', '--method', 'PATCH', 'user/email/visibility', '-f', 'visibility=private']),
    );
  }

  step(4, 'Git identity');
  const globalEmail = run('git', ['config', '--global', 'user.email'], { optional: true }) ?? '';
  const globalName = run('git', ['config', '--global', 'user.name'], { optional: true }) ?? '';
  const name = globalName || me.name || me.login;
  if (globalEmail === noreply && globalName) ok(`already ${globalName} <${noreply}>`);
  else {
    console.log(`  user.email: ${globalEmail || '(not set)'} → ${noreply}`);
    if (!globalName) console.log(`  user.name : (not set) → ${name}`);
    if (await confirm('Use them for every repository on this computer (recommended)?')) {
      change('set the identity for every repository (git config --global)', () => {
        run('git', ['config', '--global', 'user.email', noreply]);
        if (!globalName) run('git', ['config', '--global', 'user.name', name]);
      });
    } else {
      change('set the identity for this repository only', () => {
        run('git', ['config', '--local', 'user.email', noreply]);
        run('git', ['config', '--local', 'user.name', name]);
      });
    }
  }
  const localEmail = run('git', ['config', '--local', 'user.email'], { optional: true });
  if (localEmail && localEmail !== noreply) {
    change(`replace this repository's own e-mail (${localEmail})`, () =>
      run('git', ['config', '--local', 'user.email', noreply]),
    );
  }

  step(5, 'This repository');
  if (run('git', ['config', '--local', 'core.hooksPath'], { optional: true }) === '.githooks') {
    ok('the pre-commit check is already on');
  } else {
    change('turn on the pre-commit check (it refuses commits without a noreply e-mail)', () =>
      run('git', ['config', '--local', 'core.hooksPath', '.githooks']),
    );
  }
  const origin = run('git', ['remote', 'get-url', 'origin'], { optional: true }) ?? '';
  const repo = origin.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)?.[1];
  if (repo) {
    const invitations = JSON.parse(run('gh', ['api', 'user/repository_invitations']) || '[]');
    const invite = invitations.find(
      (i) => i.repository?.full_name?.toLowerCase() === repo.toLowerCase(),
    );
    if (invite) {
      change(`accept your invitation to ${repo}`, () =>
        run('gh', ['api', '--method', 'PATCH', `user/repository_invitations/${invite.id}`]),
      );
    } else ok(`no pending invitation to ${repo}`);

    // The repository belongs to an organization: members are invited to the organization.
    const org = repo.split('/')[0];
    const membership = run('gh', ['api', `user/memberships/orgs/${org}`], { optional: true });
    const state = membership === null ? null : JSON.parse(membership).state;
    if (state === 'active') ok(`you are a member of the organization ${org}`);
    else if (state === 'pending') {
      change(`accept your invitation to the organization ${org}`, () => {
        const accepted = run(
          'gh',
          ['api', '--method', 'PATCH', `user/memberships/orgs/${org}`, '-f', 'state=active'],
          { optional: true },
        );
        if (accepted === null) {
          console.log(`    Accept it in the browser: https://github.com/orgs/${org}/invitation`);
        }
      });
    }
  }
  finish(noreply);
}

/** @param {string | null} noreply */
function finish(noreply) {
  console.log('\nOne setting has no API: open https://github.com/settings/emails and tick');
  console.log('"Block command line pushes that expose my email".');
  if (DRY_RUN) console.log('\nDry run: nothing was changed.');
  else console.log(`\nDone. Your commits now carry ${noreply}.`);
}

main().catch((error) => fail(error.message));
