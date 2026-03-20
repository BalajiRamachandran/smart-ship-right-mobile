#!/usr/bin/env node
/**
 * After push: if not on default branch and no open PR exists, create one via gh CLI.
 * Set SKIP_POST_PUSH_PR=1 to disable.
 */
const { execSync } = require('child_process');

if (process.env.SKIP_POST_PUSH_PR === '1' || process.env.SKIP_POST_PUSH_PR === 'true') {
  process.exit(0);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe', ...opts }).trim();
}

function hasGh() {
  try {
    run('gh --version');
    return true;
  } catch {
    return false;
  }
}

function defaultBaseBranch() {
  try {
    const out = run('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || true');
    const m = /refs\/remotes\/origin\/(.+)/.exec(out);
    if (m) return m[1];
  } catch {}
  return 'main';
}

let branch;
try {
  branch = run('git rev-parse --abbrev-ref HEAD');
} catch {
  process.exit(0);
}

const base = defaultBaseBranch();
if (branch === base || branch === 'main' || branch === 'master') {
  process.exit(0);
}

if (!hasGh()) {
  console.log('post-push-pr: gh CLI not found; skip PR creation.');
  process.exit(0);
}

let openCount = 0;
try {
  const json = run(`gh pr list --head "${branch}" --state open --json number`);
  const arr = JSON.parse(json || '[]');
  openCount = Array.isArray(arr) ? arr.length : 0;
} catch {
  process.exit(0);
}

if (openCount > 0) {
  console.log(`post-push-pr: open PR already exists for ${branch} → ${base}.`);
  process.exit(0);
}

try {
  console.log(`post-push-pr: creating PR ${branch} → ${base}...`);
  execSync(`gh pr create --fill --base "${base}"`, { stdio: 'inherit' });
} catch (e) {
  console.log('post-push-pr: gh pr create failed (run manually if needed).');
  process.exit(0);
}
