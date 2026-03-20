#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: "${version}". Expected x.y.z`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

const pkg = readJson(pkgPath);
const app = readJson(appPath);

if (!pkg.version) {
  throw new Error('package.json is missing "version".');
}

const next = bumpPatch(pkg.version);
pkg.version = next;

if (app.expo && app.expo.version) {
  app.expo.version = next;
}

writeJson(pkgPath, pkg);
writeJson(appPath, app);

execSync('git add package.json app.json', { stdio: 'inherit' });
console.log(`Version bumped: ${next}`);
