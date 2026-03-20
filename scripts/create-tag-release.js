#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(command, options = {}) {
  return execSync(command, { stdio: 'pipe', encoding: 'utf8', ...options }).trim();
}

function runInherit(command) {
  execSync(command, { stdio: 'inherit' });
}

function commandExists(command) {
  try {
    run(`${command} --version`);
    return true;
  } catch {
    return false;
  }
}

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('Skipping release hook: package.json not found.');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) {
  console.log('Skipping release hook: package.json has no version.');
  process.exit(0);
}

const tag = `v${version}`;

// Create local annotated tag if missing.
let localTagExists = false;
try {
  const out = run(`git tag -l ${tag}`);
  localTagExists = out === tag;
} catch {}

if (!localTagExists) {
  runInherit(`git tag -a ${tag} -m "Release ${tag}"`);
  console.log(`Created tag ${tag}`);
} else {
  console.log(`Tag ${tag} already exists locally.`);
}

// Push tag to origin (safe if already pushed).
try {
  runInherit(`git push origin ${tag}`);
} catch (e) {
  console.log(`Could not push tag ${tag}.`);
  process.exit(0);
}

// Create/update GitHub release using gh CLI.
if (!commandExists('gh')) {
  console.log('Skipping GitHub release: gh CLI not available.');
  process.exit(0);
}

try {
  run(`gh release view ${tag}`);
  console.log(`GitHub release ${tag} already exists.`);
} catch {
  try {
    runInherit(`gh release create ${tag} --title "${tag}" --generate-notes`);
    console.log(`Created GitHub release ${tag}`);
  } catch {
    console.log(`Failed to create GitHub release ${tag}.`);
  }
}
