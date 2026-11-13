// Where a result comes from (ADR-009 §6): the git commit, whether the working tree had uncommitted
// changes, and the Node version. Node only. git is run directly (no shell) with fixed arguments.

import { execFileSync } from 'node:child_process';

/**
 * @param {string} cwd  a directory inside the repository
 * @param {Date} [now]
 * @returns {{ createdAt: string, commit: string, dirty: boolean | null, node: string }}
 *   commit 'unknown' and dirty null when git is not available
 */
export function provenance(cwd, now = new Date()) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  let commit = 'unknown';
  let dirty = null;
  try {
    commit = git('rev-parse', 'HEAD');
    // Tracked files only: an untracked file can change the code only through a tracked one.
    dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  } catch {
    // not a git checkout, or git is not installed: say so in the results rather than fail
  }
  return { createdAt: now.toISOString(), commit, dirty, node: process.version };
}
