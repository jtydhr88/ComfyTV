'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BUILD_INFO_NAME = 'prevision-build.json';
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repositoryState(cwd) {
  return {
    commit: git(cwd, ['rev-parse', 'HEAD']),
    branch: git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    clean: git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']) === ''
  };
}

function assertSourceValue(value, label) {
  if (typeof value !== 'string' || value.length === 0 || /[\r\n\u0000]/.test(value)) {
    throw new Error(`Invalid PreVision build ${label}.`);
  }
  return value;
}

function createBuildProvenance({
  cwd = process.cwd(),
  env = process.env,
  now = new Date(),
  state = repositoryState(cwd)
} = {}) {
  const deliveryEligible = env.PREVISION_DELIVERY_BUILD === '1';
  const commit = assertSourceValue(env.PREVISION_SOURCE_COMMIT || state.commit, 'commit');
  const branch = assertSourceValue(env.PREVISION_SOURCE_BRANCH || state.branch, 'branch');
  const clean = env.PREVISION_SOURCE_CLEAN === undefined
    ? state.clean
    : env.PREVISION_SOURCE_CLEAN === '1';
  if (!COMMIT_PATTERN.test(commit)) throw new Error('Invalid PreVision build commit.');
  if (deliveryEligible && !clean) {
    throw new Error('A delivery build must come from a clean committed worktree.');
  }
  return {
    schemaVersion: 1,
    product: 'PreVision',
    commit,
    branch,
    clean,
    deliveryEligible: deliveryEligible && clean,
    builtAt: new Date(now).toISOString()
  };
}

async function writeBuildProvenance(buildPath, options = {}) {
  const info = createBuildProvenance(options);
  await fs.writeFile(
    path.join(buildPath, BUILD_INFO_NAME),
    `${JSON.stringify(info, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o644 }
  );
  return info;
}

module.exports = {
  BUILD_INFO_NAME,
  createBuildProvenance,
  writeBuildProvenance
};
