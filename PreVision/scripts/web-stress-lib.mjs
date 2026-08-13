import fsp from 'node:fs/promises';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildWeb, startPreviewServer } from './web-runtime-lib.mjs';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(moduleDirectory, '..');
export const DEFAULT_MATRIX_PATH = 'qa/web-stress-matrix.json';
export const DEFAULT_EVIDENCE_SCHEMA_PATH = 'qa/web-stress-evidence-schema.json';
export const DEFAULT_BUILD_PATH = 'dist/web-stress-runtime';
export const DEFAULT_EVIDENCE_DIRECTORY = 'dist/web-stress-evidence';
const SUPPORTED_BROWSERS = ['chrome', 'edge', 'safari'];
const SUPPORTED_PROFILES = ['smoke', 'standard'];
const SUPPORTED_ATTESTATIONS = ['unattested', 'physical-machine', 'approved-3d-gpu-vm'];
const REQUIRED_SCENARIO_ORDER = [
  'default-load',
  'typical-multi-object',
  'panorama-4096x2048',
  'repeated-scene-switch',
  'short-shot-playback',
  'screenshot-export',
  'short-recording',
  'seedance-export',
  'long-session'
];

function fail(message) {
  throw new Error(message);
}

export function validateSyntheticStressProject(projectData, {
  objectCount = 24,
  sceneCount = 4
} = {}) {
  const reject = message => { throw new Error(message); };
  const requirePlainObject = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${label} must be an object`);
  };
  requirePlainObject(projectData, 'Synthetic stress project');
  if (projectData.name !== 'Synthetic Web Stress Project') reject('Synthetic stress project identity is missing');
  if (!Array.isArray(projectData.scenes) || projectData.scenes.length !== sceneCount) {
    reject(`Synthetic stress project must contain exactly ${sceneCount} scenes`);
  }
  const expectedLabels = Array.from(
    { length: objectCount },
    (_, index) => `Stress Object ${String(index + 1).padStart(2, '0')}`
  );
  const sceneSummaries = projectData.scenes.map((scene, sceneIndex) => {
    const scenePath = `Synthetic stress scene ${sceneIndex + 1}`;
    requirePlainObject(scene, scenePath);
    if (scene.name !== `Synthetic Stress Scene ${sceneIndex + 1}`) reject(`${scenePath} identity is missing`);
    if (!Array.isArray(scene.actors) || scene.actors.length !== objectCount) {
      reject(`${scenePath} must contain exactly ${objectCount} actors`);
    }
    const labels = scene.actors.map(actor => actor?.label);
    if (JSON.stringify(labels) !== JSON.stringify(expectedLabels)) reject(`${scenePath} actor identities do not match the fixture`);
    const labelSet = new Set(labels);
    if (!Array.isArray(scene.shots) || !scene.shots.length) reject(`${scenePath} must contain shots`);
    scene.actors.forEach((actor, actorIndex) => {
      if (actor.mount && !labelSet.has(actor.mount)) reject(`${scenePath} actor ${actorIndex + 1} has a dangling mount reference`);
      if (actor.timeLinkShot !== undefined
        && (!Number.isInteger(actor.timeLinkShot) || actor.timeLinkShot < 0 || actor.timeLinkShot >= scene.shots.length)) {
        reject(`${scenePath} actor ${actorIndex + 1} has a dangling shot timing reference`);
      }
      if (actor.path !== undefined && (!Array.isArray(actor.path)
        || actor.path.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value))))) {
        reject(`${scenePath} actor ${actorIndex + 1} has an invalid path`);
      }
    });
    const shotLocks = scene.shots.map((shot, shotIndex) => {
      const lock = shot?.lock || '\u5168\u5c40';
      if (!['\u5168\u5c40', '\u624b\u52a8\u671d\u5411'].includes(lock) && !labelSet.has(lock)) {
        reject(`${scenePath} shot ${shotIndex + 1} has a dangling camera lock reference: ${lock}`);
      }
      if (shot?.syncActor && !labelSet.has(shot.syncActor)) {
        reject(`${scenePath} shot ${shotIndex + 1} has a dangling camera sync reference: ${shot.syncActor}`);
      }
      return lock;
    });
    return { name: scene.name, actorLabels: labels, shotLocks };
  });
  return { sceneCount: projectData.scenes.length, objectCount, scenes: sceneSummaries };
}

export function createSyntheticStressOracle(projectData) {
  const freezeDeep = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  };
  const oracle = {
    scenes: (projectData?.scenes || []).map(scene => ({
      name: scene.name,
      actors: (scene.actors || []).map(actor => ({
        label: actor.label,
        kind: actor.kind,
        pos: Array.isArray(actor.pos) ? actor.pos.slice(0, 2) : [],
        path: Array.isArray(actor.path) ? actor.path.map(point => point.slice(0, 2)) : []
      }))
    }))
  };
  return freezeDeep(oracle);
}

export function validateSyntheticActiveSceneIdentity(
  oracle,
  projectData,
  runtimeActors,
  expectedSceneIndex,
  activeSceneIndex,
  context = 'scene verification'
) {
  const reject = message => { throw new Error(`${message} during ${context}`); };
  const close = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6;
  const pairMatches = (actual, expected) => Array.isArray(actual) && Array.isArray(expected)
    && actual.length >= 2 && expected.length >= 2 && close(actual[0], expected[0]) && close(actual[1], expected[1]);
  const pathMatches = (actual, expected, runtime = false) => Array.isArray(actual) && Array.isArray(expected)
    && actual.length === expected.length && actual.every((point, pointIndex) => {
      const pair = runtime ? [point?.x, point?.z] : point;
      return pairMatches(pair, expected[pointIndex]);
    });
  if (!oracle || !Array.isArray(oracle.scenes)) reject('Synthetic scene oracle is missing');
  if (!projectData || !Array.isArray(projectData.scenes) || projectData.scenes.length !== oracle.scenes.length) {
    reject('Synthetic live project scene count changed');
  }
  projectData.scenes.forEach((scene, sceneIndex) => {
    const expectedScene = oracle.scenes[sceneIndex];
    if (scene?.name !== expectedScene.name || !Array.isArray(scene?.actors) || scene.actors.length !== expectedScene.actors.length) {
      reject(`Synthetic live scene identity changed at index ${sceneIndex}`);
    }
    scene.actors.forEach((actor, actorIndex) => {
      const expectedActor = expectedScene.actors[actorIndex];
      const actualPath = Array.isArray(actor?.path) ? actor.path : [];
      const positionMatches = expectedActor.path.length
        ? pathMatches(actualPath, expectedActor.path)
          && (pairMatches(actor?.pos, expectedActor.pos) || pairMatches(actor?.pos, expectedActor.path[0]))
        : actualPath.length === 0 && pairMatches(actor?.pos, expectedActor.pos);
      if (actor?.label !== expectedActor.label || actor?.kind !== expectedActor.kind || !positionMatches) {
        reject(`Synthetic live actor identity changed at scene ${sceneIndex}, index ${actorIndex}`);
      }
    });
  });
  const expectedScene = oracle.scenes[expectedSceneIndex];
  if (!expectedScene || activeSceneIndex !== expectedSceneIndex || projectData.scenes[activeSceneIndex]?.name !== expectedScene.name) {
    reject('Synthetic active scene identity changed');
  }
  if (!Array.isArray(runtimeActors) || runtimeActors.length !== expectedScene.actors.length) {
    reject('Synthetic runtime actor count changed');
  }
  runtimeActors.forEach((actor, actorIndex) => {
    const expectedActor = expectedScene.actors[actorIndex];
    const runtimePath = Array.isArray(actor?.pathPts) ? actor.pathPts : [];
    const positionMatches = expectedActor.path.length
      ? pathMatches(runtimePath, expectedActor.path, true)
      : runtimePath.length === 0
        && close(actor?.obj?.position?.x, expectedActor.pos[0])
        && close(actor?.obj?.position?.z, expectedActor.pos[1]);
    if (actor?.label !== expectedActor.label || actor?.kind !== expectedActor.kind || !positionMatches) {
      reject(`Synthetic runtime actor identity changed at index ${actorIndex}`);
    }
  });
  return { sceneCount: oracle.scenes.length, objectCount: expectedScene.actors.length };
}

export function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

export function validateRepositoryRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || !value.length) fail(`${label} must be a non-empty repository-relative path`);
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) fail(`${label} must be repository-relative`);
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} contains a forbidden character`);
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) fail(`${label} contains an unsafe segment`);
  for (const segment of segments) {
    if (/[<>:"|?*]/.test(segment) || /[. ]$/.test(segment)) fail(`${label} is not portable to Windows`);
    const base = segment.split('.', 1)[0].toUpperCase();
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base)) fail(`${label} uses a reserved Windows device name`);
  }
  if (path.posix.normalize(value) !== value) fail(`${label} must be normalized`);
  return value;
}

function resolveInside(root, relativePath, label) {
  const safe = validateRepositoryRelativePath(relativePath, label);
  const absolute = path.resolve(root, ...safe.split('/'));
  const relation = path.relative(path.resolve(root), absolute);
  if (relation.startsWith('..') || path.isAbsolute(relation)) fail(`${label} resolves outside the repository`);
  return absolute;
}

export function validateStressMatrix(matrix) {
  assertPlainObject(matrix, 'Web stress matrix');
  if (matrix.schemaVersion !== 1) fail('Unsupported Web stress matrix schemaVersion');
  if (matrix.runtimeMode !== 'real-browser-loopback') fail('Web stress matrix must require real-browser-loopback');
  if (matrix.resultSchema !== DEFAULT_EVIDENCE_SCHEMA_PATH) fail(`Web stress matrix resultSchema must be ${DEFAULT_EVIDENCE_SCHEMA_PATH}`);
  if (!Array.isArray(matrix.requiredPlatforms) || matrix.requiredPlatforms.length !== 4) {
    fail('Web stress matrix must declare macOS Chrome/Safari and Windows Chrome/Edge');
  }
  const platformKeys = new Set(matrix.requiredPlatforms.map(item => `${item.os}:${item.browser}`));
  for (const required of ['macOS:chrome', 'macOS:safari', 'Windows:chrome', 'Windows:edge']) {
    if (!platformKeys.has(required)) fail(`Web stress matrix is missing ${required}`);
  }
  if (matrix.requiredPlatforms.some(item => item.realMachineRequired !== true)) {
    fail('Every required platform must require a real machine');
  }
  assertPlainObject(matrix.viewport, 'viewport');
  if (!Number.isInteger(matrix.viewport.outerWidth) || !Number.isInteger(matrix.viewport.outerHeight)
    || matrix.viewport.outerWidth <= 0 || matrix.viewport.outerHeight <= 0) {
    fail('viewport must use positive integer outerWidth and outerHeight');
  }
  assertPlainObject(matrix.panorama, 'panorama');
  if (matrix.panorama.width !== 4096 || matrix.panorama.height !== 2048
    || matrix.panorama.ratio !== '2:1' || matrix.panorama.format !== 'image/jpeg') {
    fail('The evidence matrix must cover an ordinary 4096x2048 2:1 panorama');
  }
  if (!Array.isArray(matrix.scenarioOrder)
    || JSON.stringify(matrix.scenarioOrder) !== JSON.stringify(REQUIRED_SCENARIO_ORDER)) {
    fail('scenarioOrder must exactly match the fixed Web stress order');
  }
  const requiredMetrics = [
    'navigation-timing', 'js-heap', 'browser-process-memory-with-platform-semantics',
    'gpu-webgl', 'fps-and-dropped-frame-estimate', 'peak-memory', 'long-session-growth',
    'crash', 'webgl-context-lost'
  ];
  if (!Array.isArray(matrix.requiredMetrics) || JSON.stringify(matrix.requiredMetrics) !== JSON.stringify(requiredMetrics)) {
    fail('requiredMetrics must exactly match the fixed Web stress metric list');
  }
  if (matrix.typicalScene?.objectCount !== 24 || matrix.typicalScene?.sceneCount !== 4) {
    fail('typicalScene must remain fixed at 24 objects and 4 scenes');
  }
  assertPlainObject(matrix.profiles, 'profiles');
  for (const profileName of SUPPORTED_PROFILES) {
    const profile = matrix.profiles[profileName];
    assertPlainObject(profile, `profiles.${profileName}`);
    for (const key of [
      'settleMs',
      'memorySampleMs',
      'sceneSwitchIterations',
      'fpsSampleMs',
      'playbackMs',
      'recordingSeconds',
      'longSessionDurationMs',
      'longSessionActionIntervalMs',
      'cooldownMs'
    ]) {
      if (!Number.isFinite(profile[key]) || profile[key] <= 0) fail(`profiles.${profileName}.${key} must be a positive number`);
      if (key !== 'recordingSeconds' && !Number.isInteger(profile[key])) {
        fail(`profiles.${profileName}.${key} must be an integer`);
      }
    }
  }
  assertPlainObject(matrix.evidence, 'evidence');
  if (matrix.evidence.ciOrEmulationCountsAsRealMachine !== false) fail('CI or emulation must not count as real-machine evidence');
  return matrix;
}

export async function readStressMatrix({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  matrixPath = DEFAULT_MATRIX_PATH
} = {}) {
  const absolute = resolveInside(repositoryRoot, matrixPath, 'matrixPath');
  const stat = await fsp.lstat(absolute).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) fail(`Missing non-symlink stress matrix: ${matrixPath}`);
  let matrix;
  try {
    matrix = JSON.parse(await fsp.readFile(absolute, 'utf8'));
  } catch (error) {
    fail(`Invalid Web stress matrix JSON: ${error.message}`);
  }
  return validateStressMatrix(matrix);
}

function optionValue(args, name) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) fail(`--${name} requires a value`);
  return args[index + 1];
}

export function parseStressArguments(args, { now = new Date() } = {}) {
  const knownFlags = new Set(['--check', '--browser', '--profile', '--output', '--attestation']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--') || !knownFlags.has(argument)) fail(`Unknown Web stress argument: ${argument}`);
    if (argument !== '--check') index += 1;
  }
  const check = args.includes('--check');
  const browser = optionValue(args, 'browser');
  const profile = optionValue(args, 'profile') || 'standard';
  const attestation = optionValue(args, 'attestation') || 'unattested';
  if (browser && !SUPPORTED_BROWSERS.includes(browser)) fail(`--browser must be one of: ${SUPPORTED_BROWSERS.join(', ')}`);
  if (!check && !browser) fail('--browser is required unless --check is used');
  if (!SUPPORTED_PROFILES.includes(profile)) fail(`--profile must be one of: ${SUPPORTED_PROFILES.join(', ')}`);
  if (!SUPPORTED_ATTESTATIONS.includes(attestation)) fail(`--attestation must be one of: ${SUPPORTED_ATTESTATIONS.join(', ')}`);
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const output = optionValue(args, 'output') || `${DEFAULT_EVIDENCE_DIRECTORY}/${browser || 'environment'}-${profile}-${stamp}.json`;
  validateRepositoryRelativePath(output, 'output');
  if (!output.startsWith(`${DEFAULT_EVIDENCE_DIRECTORY}/`) || !output.endsWith('.json')) {
    fail(`--output must be a .json child of ${DEFAULT_EVIDENCE_DIRECTORY}/`);
  }
  return { check, browser, profile, attestation, output };
}

function browserCandidates(browser, platform = process.platform, environment = process.env) {
  if (platform === 'darwin') {
    if (browser === 'chrome') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    if (browser === 'edge') return ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
    if (browser === 'safari') return ['/usr/bin/safaridriver'];
  }
  if (platform === 'win32') {
    const roots = [environment.PROGRAMFILES, environment['PROGRAMFILES(X86)'], environment.LOCALAPPDATA].filter(Boolean);
    if (browser === 'chrome') return roots.map(root => path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (browser === 'edge') return roots.map(root => path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  if (platform === 'linux') {
    if (browser === 'chrome') return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    if (browser === 'edge') return ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'];
  }
  return [];
}

async function firstExecutable(candidates, { allowSystemSafariLink = false } = {}) {
  for (const candidate of candidates) {
    try {
      await fsp.access(candidate, fs.constants.X_OK);
      const stat = await fsp.lstat(candidate);
      if (stat.isFile() && !stat.isSymbolicLink()) return candidate;
      if (allowSystemSafariLink && candidate === '/usr/bin/safaridriver' && stat.isSymbolicLink()) {
        const real = await fsp.realpath(candidate);
        if (/^\/(?:usr\/bin\/safaridriver|System\/(?:Volumes\/Preboot\/)?Cryptexes\/App\/usr\/bin\/safaridriver)$/.test(real)) {
          const target = await fsp.lstat(real);
          if (target.isFile() && !target.isSymbolicLink()) return candidate;
        }
      }
    } catch {
      // Continue to the next fixed candidate.
    }
  }
  return null;
}

function safeBrowserVersion(executable, browser, platform = process.platform) {
  if (!executable) return null;
  let command;
  let args;
  if (browser === 'safari' && platform === 'darwin') {
    command = executable;
    args = ['--version'];
  } else if (platform === 'darwin') {
    const appBoundary = executable.indexOf('.app/');
    if (appBoundary < 0) return null;
    command = '/usr/bin/plutil';
    args = ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', `${executable.slice(0, appBoundary + 4)}/Contents/Info.plist`];
  } else if (platform === 'win32') {
    command = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-Command', '(Get-Item -LiteralPath $args[0]).VersionInfo.ProductVersion', executable];
  } else {
    return null;
  }
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const value = `${result.stdout || ''} ${result.stderr || ''}`.trim().replace(/\s+/g, ' ');
  return result.status === 0 && value ? value.slice(0, 160) : null;
}

function safariAutomationAuthorization(platform = process.platform) {
  if (platform !== 'darwin') return { authorized: false, reason: 'Safari automation is only available on macOS.' };
  const result = spawnSync('/usr/bin/security', ['authorizationdb', 'read', 'com.apple.Safari.WebDriver'], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return result.status === 0
    ? { authorized: true, reason: null }
    : { authorized: false, reason: 'Safari Remote Automation is not enabled. The harness never runs safaridriver --enable.' };
}

export async function discoverBrowser(browser, {
  platform = process.platform,
  environment = process.env
} = {}) {
  if (!SUPPORTED_BROWSERS.includes(browser)) fail(`Unsupported browser: ${browser}`);
  const executable = await firstExecutable(browserCandidates(browser, platform, environment), {
    allowSystemSafariLink: browser === 'safari' && platform === 'darwin'
  });
  const installed = Boolean(executable);
  const safariAuthorization = browser === 'safari' ? safariAutomationAuthorization(platform) : { authorized: true, reason: null };
  const platformAllowed = browser === 'safari'
    ? platform === 'darwin'
    : browser === 'edge'
      ? platform === 'win32'
      : ['darwin', 'win32'].includes(platform);
  const compatible = platformAllowed && (browser === 'safari' ? safariAuthorization.authorized : installed);
  const platformBlocker = platformAllowed
    ? null
    : `${browser} is outside the required real-browser matrix on ${platform}; macOS Edge and Linux browsers do not count as Windows evidence.`;
  return {
    browser,
    installed,
    available: installed && compatible,
    platformAllowed,
    automation: browser === 'safari' ? 'WebDriver' : 'Chrome DevTools Protocol',
    automationAuthorized: browser === 'safari' ? safariAuthorization.authorized : true,
    blocker: platformBlocker || (installed && !compatible ? safariAuthorization.reason : null),
    version: safeBrowserVersion(executable, browser, platform),
    executable
  };
}

function isCiEnvironment(environment = process.env) {
  return ['CI', 'GITHUB_ACTIONS', 'BUILD_BUILDID', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(key => Boolean(environment[key]));
}

function isRequiredBrowserPair(browser, platform = process.platform) {
  return browser === 'chrome'
    ? platform === 'darwin' || platform === 'win32'
    : browser === 'edge'
      ? platform === 'win32'
      : browser === 'safari' && platform === 'darwin';
}

export async function inspectStressEnvironment({
  platform = process.platform,
  environment = process.env
} = {}) {
  const ci = isCiEnvironment(environment);
  const browsers = {};
  for (const browser of SUPPORTED_BROWSERS) {
    const found = await discoverBrowser(browser, { platform, environment });
    browsers[browser] = {
      installed: found.installed,
      available: found.available,
      platformAllowed: found.platformAllowed,
      automation: found.automation,
      automationAuthorized: found.automationAuthorized,
      blocker: found.blocker,
      version: found.version
    };
  }
  return {
    schemaVersion: 1,
    platform,
    operatingSystem: `${os.type()} ${os.release()}`,
    architecture: process.arch,
    node: process.version,
    ci,
    executionEnvironment: ci ? 'ci' : 'local-os-unattested',
    browsers,
    windowsTargetOsAvailable: platform === 'win32',
    windowsRealMachineAvailable: platform === 'win32' && !ci ? null : false,
    windowsEvidenceEligible: false,
    windowsAttestationRequired: platform === 'win32' && !ci,
    windowsBlocker: platform !== 'win32'
      ? 'This process is not running on a real Windows installation; no Windows result may be claimed from this host.'
      : ci
        ? 'Windows CI is structural coverage only and cannot count as real-browser matrix evidence.'
        : 'The Windows target OS is available, but an operator must attest physical-machine or approved-3d-gpu-vm for matrix evidence.'
  };
}

function sanitizeText(value, roots = []) {
  let text = String(value ?? '');
  const replacements = new Set([os.homedir(), DEFAULT_REPOSITORY_ROOT, ...roots].filter(Boolean));
  for (const root of replacements) text = text.split(root).join('<local-path>');
  text = text.replace(/file:\/\/\/[\w%+.,@~\-/\\:]+/gi, 'file:///<local-path>');
  text = text.replace(/(?:[A-Za-z]:\\Users\\[^\\\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+)/g, '<user-home>');
  return text.slice(0, 2000);
}

const publicNumber = value => Number.isFinite(value) ? value : null;
const publicBoolean = value => typeof value === 'boolean' ? value : null;
const publicEnum = (value, allowed, fallback = null) => allowed.includes(value) ? value : fallback;
const publicHash = value => typeof value === 'string' && /^[a-f0-9]{40,64}$/i.test(value) ? value.toLowerCase() : null;
const publicTimestamp = value => {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
};

function publicNavigation(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    ...Object.fromEntries([
    'responseStartMs', 'domContentLoadedMs', 'loadEventMs', 'transferSize', 'encodedBodySize',
    'decodedBodySize', 'firstPaintMs', 'firstContentfulPaintMs'
    ].map(key => [key, publicNumber(value?.[key])])),
    paintTimingStatus: Number.isFinite(value.firstPaintMs) || Number.isFinite(value.firstContentfulPaintMs)
      ? 'measured'
      : 'unsupported',
    paintTimingReasonCode: Number.isFinite(value.firstPaintMs) || Number.isFinite(value.firstContentfulPaintMs)
      ? null
      : 'paint-timing-unavailable'
  };
}

function publicFps(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    durationMs: publicNumber(value.durationMs),
    frames: publicNumber(value.frames),
    fps: publicNumber(value.fps),
    baselineFrameMs: publicNumber(value.baselineFrameMs),
    missedVsyncEstimate: publicNumber(value.missedVsyncEstimate),
    estimateMethod: publicEnum(value.estimateMethod, ['measured-idle-rAF-baseline', 'unavailable']),
    over33ms: publicNumber(value.over33ms),
    over50ms: publicNumber(value.over50ms),
    p50FrameMs: publicNumber(value.p50FrameMs),
    p95FrameMs: publicNumber(value.p95FrameMs),
    p99FrameMs: publicNumber(value.p99FrameMs),
    maxFrameMs: publicNumber(value.maxFrameMs),
    valid: publicBoolean(value.valid),
    visibilityChangeCount: Array.isArray(value.visibilityChanges) ? value.visibilityChanges.length : 0
  };
}

function publicPageMetric(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const mainCanvas = Array.isArray(value.viewport?.canvasPixels)
    ? value.viewport.canvasPixels.find(canvas => canvas?.id === 'gl')
    : null;
  return {
    atMs: publicNumber(value.atMs),
    jsHeap: value.jsHeap ? {
      usedJSHeapSize: publicNumber(value.jsHeap.usedJSHeapSize),
      totalJSHeapSize: publicNumber(value.jsHeap.totalJSHeapSize),
      jsHeapSizeLimit: publicNumber(value.jsHeap.jsHeapSizeLimit)
    } : null,
    jsHeapStatus: value.jsHeap ? 'measured' : 'unsupported',
    jsHeapReasonCode: value.jsHeap ? null : 'performance-memory-unavailable',
    renderer: {
      memory: {
        geometries: publicNumber(value.renderer?.memory?.geometries),
        textures: publicNumber(value.renderer?.memory?.textures)
      },
      render: {
        calls: publicNumber(value.renderer?.render?.calls),
        triangles: publicNumber(value.renderer?.render?.triangles),
        points: publicNumber(value.renderer?.render?.points),
        lines: publicNumber(value.renderer?.render?.lines)
      }
    },
    webgl: {
      maxTextureSize: publicNumber(value.webgl?.maxTextureSize),
      maxCubeMapTextureSize: publicNumber(value.webgl?.maxCubeMapTextureSize),
      maxRenderbufferSize: publicNumber(value.webgl?.maxRenderbufferSize),
      antialias: publicBoolean(value.webgl?.antialias),
      contextLost: publicBoolean(value.webgl?.contextLost)
    },
    domNodes: publicNumber(value.domNodes),
    canvases: publicNumber(value.canvases),
    viewport: {
      outerWidth: publicNumber(value.viewport?.outerWidth),
      outerHeight: publicNumber(value.viewport?.outerHeight),
      innerWidth: publicNumber(value.viewport?.innerWidth),
      innerHeight: publicNumber(value.viewport?.innerHeight),
      devicePixelRatio: publicNumber(value.viewport?.devicePixelRatio),
      visibilityState: publicEnum(value.viewport?.visibilityState, ['visible', 'hidden', 'prerender', 'unloaded']),
      mainCanvas: mainCanvas ? { width: publicNumber(mainCanvas.width), height: publicNumber(mainCanvas.height) } : null
    },
    captureCapabilities: {
      mediaRecorder: publicBoolean(value.captureCapabilities?.mediaRecorder),
      canvasCaptureStream: publicBoolean(value.captureCapabilities?.canvasCaptureStream),
      requestFrame: publicBoolean(value.captureCapabilities?.requestFrame)
    },
    contextLost: publicNumber(value.contextLost),
    contextRestored: publicNumber(value.contextRestored)
  };
}

function publicArtifact(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const baseType = typeof value.type === 'string' ? value.type.split(';', 1)[0].toLowerCase() : value.type;
  const normalizedKind = value.kind === 'video' ? 'recording-video'
    : value.kind === 'zip' ? 'seedance-zip'
      : value.kind;
  const normalizedExtension = typeof value.extension === 'string' ? value.extension.replace(/^\./, '') : value.extension;
  return {
    sequence: publicNumber(value.sequence),
    kind: publicEnum(normalizedKind, ['screenshot-png', 'recording-video', 'seedance-zip']),
    size: publicNumber(value.size),
    type: publicEnum(baseType, ['image/png', 'video/mp4', 'video/webm', 'application/zip']),
    extension: publicEnum(normalizedExtension, ['mp4', 'webm']),
    validation: {
      status: publicEnum(value.validation?.status, ['passed', 'failed']),
      format: publicEnum(value.validation?.format, ['png', 'mp4', 'webm', 'zip']),
      signatureValid: publicBoolean(value.validation?.signatureValid),
      width: publicNumber(value.validation?.width),
      height: publicNumber(value.validation?.height),
      centralDirectoryFound: publicBoolean(value.validation?.centralDirectoryFound),
      entryCount: publicNumber(value.validation?.entryCount),
      expectedEntriesPresent: publicBoolean(value.validation?.expectedEntriesPresent),
      allEntriesNonEmpty: publicBoolean(value.validation?.allEntriesNonEmpty)
    }
  };
}

function publicScenarioDetails(id, value = {}) {
  value = value && typeof value === 'object' ? value : {};
  if (id === 'default-load') return {
    navigation: publicNavigation(value.navigation), idleFps: publicFps(value.idleFps),
    sceneCount: publicNumber(value.sceneCount), objectCount: publicNumber(value.objectCount)
  };
  if (id === 'typical-multi-object') return { sceneCount: publicNumber(value.sceneCount), objectCount: publicNumber(value.objectCount) };
  if (id === 'panorama-4096x2048') return {
    width: publicNumber(value.width), height: publicNumber(value.height), encodedBytes: publicNumber(value.encodedBytes),
    textureReady: publicBoolean(value.textureReady), naturalWidth: publicNumber(value.naturalWidth),
    naturalHeight: publicNumber(value.naturalHeight), maxTextureSize: publicNumber(value.maxTextureSize)
  };
  if (id === 'repeated-scene-switch') return {
    iterations: publicNumber(value.iterations), durationMs: publicNumber(value.durationMs), finalSceneIndex: publicNumber(value.finalSceneIndex),
    sceneCount: publicNumber(value.sceneCount), objectCount: publicNumber(value.objectCount)
  };
  if (id === 'short-shot-playback') return {
    fps: publicFps(value.fps), configuredShotDurationSeconds: publicNumber(value.configuredShotDurationSeconds),
    wallDurationMs: publicNumber(value.wallDurationMs)
  };
  if (id === 'screenshot-export') return { output: publicArtifact(value.output) };
  if (id === 'short-recording' || id === 'seedance-export') return {
    durationSeconds: publicNumber(value.durationSeconds), output: publicArtifact(value.output)
  };
  if (id === 'long-session') return {
    observationDurationMs: publicNumber(value.observationDurationMs), cycles: publicNumber(value.cycles),
    fps: publicFps(value.fps), before: publicPageMetric(value.before), after: publicPageMetric(value.after),
    usedJSHeapDelta: publicNumber(value.usedJSHeapDelta),
    sceneCount: publicNumber(value.sceneCount), objectCount: publicNumber(value.objectCount)
  };
  return null;
}

function publicProcessMemory(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    status: publicEnum(value.status, ['measured', 'unsupported']),
    metric: publicEnum(value.metric, ['rss-sum', 'working-set-sum']),
    beforeBytes: publicNumber(value.beforeBytes), afterBytes: publicNumber(value.afterBytes),
    peakBytes: publicNumber(value.peakBytes), deltaBytes: publicNumber(value.deltaBytes),
    sampleCount: publicNumber(value.sampleCount), processCountPeak: publicNumber(value.processCountPeak),
    reasonCode: value.status === 'unsupported' ? 'isolated-process-memory-unavailable' : null
  };
}

export function buildPublicEvidence(raw = {}, roots = []) {
  const allowedScenarioIds = [
    'default-load', 'typical-multi-object', 'panorama-4096x2048', 'repeated-scene-switch',
    'short-shot-playback', 'screenshot-export', 'short-recording', 'seedance-export', 'long-session'
  ];
  const scenarios = Array.isArray(raw.scenarios) ? raw.scenarios.filter(item => allowedScenarioIds.includes(item?.id)).map(item => ({
    id: item.id,
    status: publicEnum(item.status, ['passed', 'failed', 'not-run'], 'failed'),
    failureReasonCode: publicEnum(item.failureReasonCode, [
      'scenario-error', 'browser-alert', 'browser-terminated-before-scenario'
    ]),
    startedAt: publicTimestamp(item.startedAt), endedAt: publicTimestamp(item.endedAt),
    wallDurationMs: publicNumber(item.wallDurationMs),
    page: {
      durationMs: publicNumber(item.page?.durationMs),
      before: publicPageMetric(item.page?.before), after: publicPageMetric(item.page?.after),
      heapSamples: Array.isArray(item.page?.heapSamples) ? item.page.heapSamples.map(sample => ({
        atMs: publicNumber(sample.atMs), usedJSHeapSize: publicNumber(sample.usedJSHeapSize), totalJSHeapSize: publicNumber(sample.totalJSHeapSize)
      })) : []
    },
    details: publicScenarioDetails(item.id, item.details),
    events: {
      alertCount: publicNumber(item.events?.alertCount), contextLost: publicNumber(item.events?.contextLost),
      contextRestored: publicNumber(item.events?.contextRestored),
      errorCodes: Array.isArray(item.events?.errorCodes) ? item.events.errorCodes.map(code => publicEnum(code, [
        'recording-cleanup-failed', 'download-interception-install-failed', 'native-download-guard-used',
        'renderer-observer-install-failed'
      ], 'unrecognized-error-code')) : [],
      outputs: Array.isArray(item.events?.outputs) ? item.events.outputs.map(publicArtifact) : []
    },
    processMemory: publicProcessMemory(item.processMemory)
  })) : [];
  const harnessFiles = raw.harness?.files || {};
  const processSamples = Array.isArray(raw.processSamples) ? raw.processSamples.map(sample => ({
    atEpochMs: publicNumber(sample.atEpochMs), memoryBytes: publicNumber(sample.memoryBytes),
    processCount: publicNumber(sample.processCount),
    errorCode: publicEnum(sample.errorCode, ['process-memory-sample-failed'])
  })) : [];
  return {
    schemaVersion: 1,
    taskId: '04.web-cross-platform-stress',
    sourceCommit: publicHash(raw.sourceCommit),
    harness: {
      schemaVersion: 1,
      files: {
        'scripts/web-stress-lib.mjs': publicHash(harnessFiles['scripts/web-stress-lib.mjs']),
        'scripts/run-web-stress.mjs': publicHash(harnessFiles['scripts/run-web-stress.mjs']),
        'qa/web-stress-matrix.json': publicHash(harnessFiles['qa/web-stress-matrix.json']),
        'qa/web-stress-evidence-schema.json': publicHash(harnessFiles['qa/web-stress-evidence-schema.json'])
      }
    },
    profile: publicEnum(raw.profile, ['smoke', 'standard']),
    startedAt: publicTimestamp(raw.startedAt), completedAt: publicTimestamp(raw.completedAt), durationMs: publicNumber(raw.durationMs),
    environment: {
      operatingSystem: sanitizeText(raw.environment?.operatingSystem, roots),
      platform: publicEnum(raw.environment?.platform, ['darwin', 'win32']),
      architecture: publicEnum(raw.environment?.architecture, ['arm64', 'x64']),
      logicalCpuCount: publicNumber(raw.environment?.logicalCpuCount),
      totalMemoryGiBRounded: publicNumber(raw.environment?.totalMemoryGiBRounded),
      node: sanitizeText(raw.environment?.node, roots),
      browser: {
        name: publicEnum(raw.environment?.browser?.name, ['chrome', 'edge', 'safari']),
        version: sanitizeText(raw.environment?.browser?.version, roots),
        automation: publicEnum(raw.environment?.browser?.automation, ['cdp', 'webdriver'])
      },
      ci: publicBoolean(raw.environment?.ci),
      executionEnvironment: publicEnum(raw.environment?.executionEnvironment, [
        'ci', 'local-os-unattested', 'local-physical-machine', 'approved-3d-gpu-vm'
      ]),
      realMachineAttestation: publicEnum(raw.environment?.realMachineAttestation, [
        'unattested', 'physical-machine', 'approved-3d-gpu-vm'
      ]),
      targetOsBrowserPair: publicBoolean(raw.environment?.targetOsBrowserPair),
      matrixEvidenceEligible: publicBoolean(raw.environment?.matrixEvidenceEligible),
      evidenceEligibilityBasis: publicEnum(raw.environment?.evidenceEligibilityBasis, [
        'operator-attested-physical-machine', 'operator-attested-approved-3d-gpu-vm',
        'pending-operator-attestation', 'ineligible-environment', 'software-rendering-detected',
        'gpu-diagnostics-unavailable'
      ]),
      hostnameExcluded: true,
      usernameExcluded: true
    },
    runtime: {
      staticBuildHomeMode: publicEnum(raw.runtime?.staticBuildHomeMode, ['director-fallback', 'provided-home']),
      deploymentManifestSha256: publicHash(raw.runtime?.deploymentManifestSha256),
      directorSha256: publicHash(raw.runtime?.directorSha256),
      route: '/director/', previewBinding: '127.0.0.1', applicationNetworkScope: 'loopback-only',
      renderSchedulingControl: publicEnum(raw.runtime?.renderSchedulingControl, [
        'headful-background-throttling-disabled-visibility-still-observed',
        'native-safari-scheduling-visibility-observed'
      ]),
      browserExternalNetworkControl: publicEnum(raw.runtime?.browserExternalNetworkControl, [
        'not-measured-by-webdriver', 'closed-loopback-browser-and-process-proxy-plus-host-resolver-deny'
      ]),
      projectDataUploadPathPresent: false,
      browserIsolation: publicEnum(raw.runtime?.browserIsolation, ['safari-webdriver-isolated-session', 'temporary-user-data-directory']),
      generatedArtifactHandling: 'in-memory-metadata-only'
    },
    parameters: {
      profile: {
        settleMs: publicNumber(raw.parameters?.profile?.settleMs), memorySampleMs: publicNumber(raw.parameters?.profile?.memorySampleMs),
        sceneSwitchIterations: publicNumber(raw.parameters?.profile?.sceneSwitchIterations), fpsSampleMs: publicNumber(raw.parameters?.profile?.fpsSampleMs),
        playbackMs: publicNumber(raw.parameters?.profile?.playbackMs), recordingSeconds: publicNumber(raw.parameters?.profile?.recordingSeconds),
        longSessionDurationMs: publicNumber(raw.parameters?.profile?.longSessionDurationMs),
        longSessionActionIntervalMs: publicNumber(raw.parameters?.profile?.longSessionActionIntervalMs), cooldownMs: publicNumber(raw.parameters?.profile?.cooldownMs)
      },
      panorama: {
        width: publicNumber(raw.parameters?.panorama?.width), height: publicNumber(raw.parameters?.panorama?.height),
        ratio: publicEnum(raw.parameters?.panorama?.ratio, ['2:1']), format: publicEnum(raw.parameters?.panorama?.format, ['image/jpeg'])
      },
      typicalScene: {
        objectCount: publicNumber(raw.parameters?.typicalScene?.objectCount), sceneCount: publicNumber(raw.parameters?.typicalScene?.sceneCount)
      },
      viewport: {
        outerWidth: publicNumber(raw.parameters?.viewport?.outerWidth), outerHeight: publicNumber(raw.parameters?.viewport?.outerHeight)
      }
    },
    bootstrap: {
      schemaVersion: 1, ready: publicBoolean(raw.bootstrap?.ready), navigation: publicNavigation(raw.bootstrap?.navigation),
      page: publicPageMetric(raw.bootstrap?.page)
    },
    browserSystem: {
      status: publicEnum(raw.browserSystem?.status, ['measured', 'unsupported']),
      source: publicEnum(raw.browserSystem?.source, ['cdp-system-info', 'webdriver']),
      deviceCount: publicNumber(raw.browserSystem?.deviceCount),
      category: publicEnum(raw.browserSystem?.category, ['software', 'apple-silicon-or-apple-gpu', 'hardware-unspecified']),
      softwareRenderingDetected: publicBoolean(raw.browserSystem?.softwareRenderingDetected),
      reasonCode: raw.browserSystem?.status === 'unsupported' ? 'browser-gpu-diagnostics-unavailable' : null
    },
    scenarios,
    memory: {
      processMemoryMetric: publicEnum(raw.memory?.processMemoryMetric, ['rss-sum', 'working-set-sum']),
      processMemorySampledPeakBytes: publicNumber(raw.memory?.processMemorySampledPeakBytes),
      processMemoryStatus: raw.memory?.processMemorySampledPeakBytes == null ? 'unsupported' : 'measured',
      processMemoryReasonCode: raw.memory?.processMemorySampledPeakBytes == null ? 'isolated-process-memory-unavailable' : null,
      jsHeapSampledPeakBytes: publicNumber(raw.memory?.jsHeapSampledPeakBytes),
      jsHeapStatus: raw.memory?.jsHeapSampledPeakBytes == null ? 'unsupported' : 'measured',
      jsHeapReasonCode: raw.memory?.jsHeapSampledPeakBytes == null ? 'performance-memory-unavailable' : null,
      longSession: raw.memory?.longSession ? {
        observationDurationMs: publicNumber(raw.memory.longSession.observationDurationMs),
        processMemoryDeltaBytes: publicNumber(raw.memory.longSession.processMemoryDeltaBytes),
        usedJSHeapDeltaBytes: publicNumber(raw.memory.longSession.usedJSHeapDeltaBytes)
      } : null
    },
    processMemorySampling: {
      requestedIntervalMs: publicNumber(raw.processMemorySampling?.requestedIntervalMs),
      effectiveIntervalMs: publicNumber(raw.processMemorySampling?.effectiveIntervalMs),
      methodOverhead: publicEnum(raw.processMemorySampling?.methodOverhead, [
        'powershell-cim-process-table-every-2s-or-slower', 'posix-ps-process-table', 'unsupported'
      ])
    },
    processSamples,
    browserEvents: {
      consoleCollection: publicEnum(raw.browserEvents?.consoleCollection, ['measured', 'unsupported']),
      consoleErrorCount: publicNumber(raw.browserEvents?.consoleErrorCount), exceptionCount: publicNumber(raw.browserEvents?.exceptionCount),
      crashStatus: publicEnum(raw.browserEvents?.crashStatus, ['observed', 'not-observed', 'unsupported']),
      detachedStatus: publicEnum(raw.browserEvents?.detachedStatus, ['observed', 'not-observed']),
      consoleLimitationCode: raw.browserEvents?.consoleCollection === 'unsupported' ? 'browser-console-collection-unavailable' : null,
      crashDetectionLimitationCode: raw.browserEvents?.crashStatus === 'unsupported' ? 'browser-crash-event-unavailable' : null
    },
    verdict: {
      completed: publicBoolean(raw.verdict?.completed),
      matrixEvidenceEligible: publicBoolean(raw.verdict?.matrixEvidenceEligible),
      evidenceEligibilityBasis: publicEnum(raw.verdict?.evidenceEligibilityBasis, [
        'operator-attested-physical-machine', 'operator-attested-approved-3d-gpu-vm',
        'pending-operator-attestation', 'ineligible-environment', 'software-rendering-detected',
        'gpu-diagnostics-unavailable'
      ]),
      failedScenarios: Array.isArray(raw.verdict?.failedScenarios) ? raw.verdict.failedScenarios.filter(id => allowedScenarioIds.includes(id)) : [],
      crash: {
        status: publicEnum(raw.verdict?.crash?.status, ['observed', 'not-observed', 'unsupported']),
        detection: publicEnum(raw.verdict?.crash?.detection, ['cdp-target-and-owned-process', 'webdriver-command-channel-only']),
        reasonCode: raw.verdict?.crash?.status === 'unsupported' ? 'browser-crash-event-unavailable' : null
      },
      webglContextLost: {
        status: publicEnum(raw.verdict?.webglContextLost?.status, ['observed', 'not-observed']),
        count: publicNumber(raw.verdict?.webglContextLost?.count), observationDurationMs: publicNumber(raw.verdict?.webglContextLost?.observationDurationMs)
      },
      optimizationDecision: 'No product limit or optimization is inferred automatically; compare this evidence across the required real browsers first.'
    },
    evidencePolicy: {
      schemaVersion: 1,
      exclude: ['hostname', 'username', 'absolute-path', 'browser-profile', 'project-content'],
      unsupportedMetricValue: null, unsupportedMetricReasonRequired: true, ciOrEmulationCountsAsRealMachine: false
    },
    cleanup: {
      status: publicEnum(raw.cleanup?.status, ['passed', 'failed'], 'failed'),
      errors: Array.isArray(raw.cleanup?.errors) ? raw.cleanup.errors.map(code => publicEnum(code, [
        'page-runtime-cleanup-reported-error', 'page-teardown-failed', 'process-sampler-stop-failed',
        'browser-cleanup-failed', 'owned-browser-process-not-terminated', 'owned-crash-helper-not-terminated',
        'owned-browser-profile-not-removed', 'preview-cleanup-failed', 'build-cleanup-failed'
      ], 'unrecognized-cleanup-error')) : [],
      pageTeardown: {
        cleaned: publicBoolean(raw.cleanup?.pageTeardown?.cleaned),
        errorCodes: Array.isArray(raw.cleanup?.pageTeardown?.errorCodes)
          ? raw.cleanup.pageTeardown.errorCodes.map(() => 'page-runtime-error')
          : []
      }
    }
  };
}

function schemaValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function resolveLocalSchemaReference(rootSchema, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) fail('Public evidence schema uses an unsupported reference');
  let current = rootSchema;
  for (const encoded of reference.slice(2).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) {
      fail('Public evidence schema contains an unresolved reference');
    }
    current = current[key];
  }
  return current;
}

function validateSchemaValue(value, rule, rootSchema, label) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) fail(`${label} has an invalid schema rule`);
  if (rule.$ref) return validateSchemaValue(value, resolveLocalSchemaReference(rootSchema, rule.$ref), rootSchema, label);
  if (Array.isArray(rule.anyOf)) {
    for (const candidate of rule.anyOf) {
      try {
        validateSchemaValue(value, candidate, rootSchema, label);
        return;
      } catch {
        // Try the next explicitly declared alternative.
      }
    }
    fail(`${label} does not match any allowed schema alternative`);
  }
  if (Object.hasOwn(rule, 'const') && JSON.stringify(value) !== JSON.stringify(rule.const)) {
    fail(`${label} does not match its required constant`);
  }
  if (Array.isArray(rule.enum) && !rule.enum.some(candidate => JSON.stringify(candidate) === JSON.stringify(value))) {
    fail(`${label} is outside its allowed values`);
  }
  if (rule.type) {
    const allowedTypes = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!allowedTypes.includes(schemaValueType(value))) fail(`${label} has the wrong type`);
  }
  if (typeof value === 'string') {
    if (Number.isInteger(rule.maxLength) && value.length > rule.maxLength) fail(`${label} is too long`);
    if (rule.pattern && !new RegExp(rule.pattern, 'u').test(value)) fail(`${label} does not match its required pattern`);
    if (rule.format === 'date-time' && (!Number.isFinite(Date.parse(value)) || !/[Tt].*(?:[Zz]|[+-]\d\d:\d\d)$/.test(value))) {
      fail(`${label} is not a date-time`);
    }
  }
  if (Array.isArray(value)) {
    if (rule.items) value.forEach((item, index) => validateSchemaValue(item, rule.items, rootSchema, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const properties = rule.properties || {};
  for (const required of rule.required || []) {
    if (!Object.hasOwn(value, required)) fail(`${label}.${required} is required`);
  }
  if (rule.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key)) fail(`${label}.${key} is not allowed`);
    }
  }
  for (const [key, item] of Object.entries(value)) {
    if (Object.hasOwn(properties, key)) validateSchemaValue(item, properties[key], rootSchema, `${label}.${key}`);
  }
}

export function validatePublicEvidence(evidence, schema) {
  assertPlainObject(evidence, 'public Web stress evidence');
  assertPlainObject(schema, 'Web stress evidence schema');
  validateSchemaValue(evidence, schema, schema, 'publicEvidence');
  const scenarioIds = evidence.scenarios.map(item => item.id);
  if (JSON.stringify(scenarioIds) !== JSON.stringify(REQUIRED_SCENARIO_ORDER)) {
    fail('Public evidence must contain the complete fixed scenario order');
  }
  const failedScenarios = evidence.scenarios.filter(item => item.status !== 'passed').map(item => item.id);
  if (JSON.stringify(evidence.verdict.failedScenarios) !== JSON.stringify(failedScenarios)) {
    fail('Public evidence failedScenarios does not match scenario results');
  }
  if (evidence.verdict.completed === true && (
    failedScenarios.length
    || evidence.cleanup.status !== 'passed'
    || evidence.verdict.crash.status === 'observed'
    || evidence.verdict.webglContextLost.status === 'observed'
  )) fail('Completed public evidence contains a failed, crashed, context-lost, or unclean run');
  const environment = evidence.environment;
  const derivedTargetPair = (environment.platform === 'darwin'
    && ((environment.browser.name === 'chrome' && environment.browser.automation === 'cdp')
      || (environment.browser.name === 'safari' && environment.browser.automation === 'webdriver')))
    || (environment.platform === 'win32'
      && ['chrome', 'edge'].includes(environment.browser.name)
      && environment.browser.automation === 'cdp');
  if (environment.targetOsBrowserPair !== derivedTargetPair) {
    fail('Public evidence browser automation does not match a required OS/browser matrix pair');
  }
  const expectedRenderScheduling = environment.browser.name === 'safari'
    ? 'native-safari-scheduling-visibility-observed'
    : 'headful-background-throttling-disabled-visibility-still-observed';
  if (evidence.runtime.renderSchedulingControl !== expectedRenderScheduling) {
    fail('Public evidence render scheduling control does not match its browser');
  }
  const attestationIsEligible = environment.realMachineAttestation === 'physical-machine'
    || (environment.realMachineAttestation === 'approved-3d-gpu-vm' && environment.platform === 'win32');
  if (environment.realMachineAttestation === 'approved-3d-gpu-vm' && environment.platform !== 'win32') {
    fail('Approved 3D GPU VM attestation is only valid for the Windows matrix');
  }
  const gpuEvidenceEligible = environment.browser.name === 'safari'
    || (evidence.browserSystem.status === 'measured'
      && Number(evidence.browserSystem.deviceCount) > 0
      && evidence.browserSystem.softwareRenderingDetected === false);
  const expectedEligibility = environment.ci === false
    && environment.targetOsBrowserPair === true
    && attestationIsEligible
    && gpuEvidenceEligible;
  const expectedBasis = evidence.browserSystem.softwareRenderingDetected === true
    ? 'software-rendering-detected'
    : !gpuEvidenceEligible
      ? 'gpu-diagnostics-unavailable'
    : environment.ci === true || environment.targetOsBrowserPair !== true
      ? 'ineligible-environment'
      : environment.realMachineAttestation === 'physical-machine'
        ? 'operator-attested-physical-machine'
        : environment.realMachineAttestation === 'approved-3d-gpu-vm'
          ? 'operator-attested-approved-3d-gpu-vm'
          : 'pending-operator-attestation';
  if (environment.matrixEvidenceEligible !== expectedEligibility
    || evidence.verdict.matrixEvidenceEligible !== expectedEligibility
    || environment.evidenceEligibilityBasis !== expectedBasis
    || evidence.verdict.evidenceEligibilityBasis !== expectedBasis) {
    fail('Public evidence machine eligibility fields are inconsistent');
  }
  const expectedExecutionEnvironment = environment.ci
    ? 'ci'
    : environment.realMachineAttestation === 'physical-machine'
      ? 'local-physical-machine'
      : environment.realMachineAttestation === 'approved-3d-gpu-vm'
        ? 'approved-3d-gpu-vm'
        : 'local-os-unattested';
  if (environment.executionEnvironment !== expectedExecutionEnvironment) {
    fail('Public evidence execution environment is inconsistent with its attestation');
  }
  if (!/^[a-f0-9]{40}$/.test(evidence.sourceCommit || '')
    || Object.values(evidence.harness.files).some(hash => !/^[a-f0-9]{64}$/.test(hash || ''))) {
    fail('Public evidence is missing source or harness identity hashes');
  }
  const validateNavigationSemantics = (navigation, label) => {
    const hasPaint = navigation.firstPaintMs != null || navigation.firstContentfulPaintMs != null;
    if (navigation.paintTimingStatus === 'unsupported') {
      if (hasPaint || navigation.paintTimingReasonCode !== 'paint-timing-unavailable') {
        fail(`${label} unsupported paint timing is missing its fixed reason`);
      }
    } else if (!hasPaint || navigation.paintTimingReasonCode !== null) {
      fail(`${label} measured paint timing is inconsistent`);
    }
  };
  const validatePageSemantics = (page, label) => {
    if (page.jsHeapStatus === 'unsupported') {
      if (page.jsHeap !== null || page.jsHeapReasonCode !== 'performance-memory-unavailable') {
        fail(`${label} unsupported JS heap is missing its fixed reason`);
      }
    } else if (page.jsHeap === null || page.jsHeapReasonCode !== null) {
      fail(`${label} measured JS heap is inconsistent`);
    }
  };
  validateNavigationSemantics(evidence.bootstrap.navigation, 'bootstrap.navigation');
  validatePageSemantics(evidence.bootstrap.page, 'bootstrap.page');
  for (const scenario of evidence.scenarios) {
    validatePageSemantics(scenario.page.before, `${scenario.id}.page.before`);
    validatePageSemantics(scenario.page.after, `${scenario.id}.page.after`);
    if (scenario.id === 'default-load') validateNavigationSemantics(scenario.details.navigation, 'default-load.navigation');
    if (scenario.id === 'long-session') {
      validatePageSemantics(scenario.details.before, 'long-session.before');
      validatePageSemantics(scenario.details.after, 'long-session.after');
    }
    const processMemory = scenario.processMemory;
    if (processMemory.status === 'unsupported') {
      if (processMemory.peakBytes !== null || processMemory.reasonCode !== 'isolated-process-memory-unavailable') {
        fail(`${scenario.id} unsupported process memory is missing its fixed reason`);
      }
    } else if (processMemory.peakBytes === null || processMemory.metric === null || processMemory.reasonCode !== null) {
      fail(`${scenario.id} measured process memory is inconsistent`);
    }
    const validateArtifactSemantics = (artifact, label) => {
      if (artifact.kind == null) return;
      if (artifact.size <= 0 || artifact.validation.status !== 'passed' || artifact.validation.signatureValid !== true) {
        fail(`${label} is not a non-empty signature-validated artifact`);
      }
      if (artifact.kind === 'screenshot-png' && (
        artifact.type !== 'image/png' || artifact.extension !== null || artifact.validation.format !== 'png'
        || !(artifact.validation.width > 0) || !(artifact.validation.height > 0)
      )) fail(`${label} PNG metadata is inconsistent`);
      if (artifact.kind === 'recording-video') {
        const expectedFormat = artifact.type === 'video/mp4' ? 'mp4'
          : artifact.type === 'video/webm' ? 'webm' : null;
        if (!expectedFormat || artifact.extension !== expectedFormat || artifact.validation.format !== expectedFormat) {
          fail(`${label} video metadata is inconsistent`);
        }
      }
      if (artifact.kind === 'seedance-zip' && (
        artifact.type !== 'application/zip' || artifact.extension !== null || artifact.validation.format !== 'zip'
        || artifact.validation.centralDirectoryFound !== true || artifact.validation.entryCount !== 5
        || artifact.validation.expectedEntriesPresent !== true || artifact.validation.allEntriesNonEmpty !== true
      )) fail(`${label} Seedance ZIP metadata is inconsistent`);
    };
    for (const [index, artifact] of scenario.events.outputs.entries()) {
      validateArtifactSemantics(artifact, `${scenario.id}.events.outputs[${index}]`);
    }
    if (scenario.status === 'passed' && ['screenshot-export', 'short-recording', 'seedance-export'].includes(scenario.id)) {
      const expectedKind = scenario.id === 'screenshot-export' ? 'screenshot-png'
        : scenario.id === 'short-recording' ? 'recording-video' : 'seedance-zip';
      validateArtifactSemantics(scenario.details.output, `${scenario.id}.details.output`);
      if (scenario.details.output.kind !== expectedKind) {
        fail(`${scenario.id} passed without a validated generated artifact`);
      }
    }
  }
  if (evidence.browserSystem.status === 'unsupported') {
    if (evidence.browserSystem.deviceCount !== null || evidence.browserSystem.category !== null
      || evidence.browserSystem.softwareRenderingDetected !== null
      || evidence.browserSystem.reasonCode !== 'browser-gpu-diagnostics-unavailable') {
      fail('Unsupported browser GPU diagnostics are missing their fixed reason');
    }
  } else if (evidence.browserSystem.reasonCode !== null
    || typeof evidence.browserSystem.softwareRenderingDetected !== 'boolean') {
    fail('Measured browser GPU diagnostics are inconsistent');
  }
  if (evidence.memory.processMemoryStatus === 'unsupported') {
    if (evidence.memory.processMemorySampledPeakBytes !== null
      || evidence.memory.processMemoryReasonCode !== 'isolated-process-memory-unavailable') {
      fail('Unsupported process-memory summary is missing its fixed reason');
    }
  } else if (evidence.memory.processMemorySampledPeakBytes === null || evidence.memory.processMemoryReasonCode !== null) {
    fail('Measured process-memory summary is inconsistent');
  }
  if (evidence.memory.jsHeapStatus === 'unsupported') {
    if (evidence.memory.jsHeapSampledPeakBytes !== null
      || evidence.memory.jsHeapReasonCode !== 'performance-memory-unavailable') {
      fail('Unsupported JS-heap summary is missing its fixed reason');
    }
  } else if (evidence.memory.jsHeapSampledPeakBytes === null || evidence.memory.jsHeapReasonCode !== null) {
    fail('Measured JS-heap summary is inconsistent');
  }
  if (evidence.browserEvents.consoleCollection === 'unsupported') {
    if (evidence.browserEvents.consoleLimitationCode !== 'browser-console-collection-unavailable') {
      fail('Unsupported console collection is missing its fixed reason');
    }
  } else if (evidence.browserEvents.consoleLimitationCode !== null) {
    fail('Measured console collection has an unsupported reason');
  }
  if (evidence.browserEvents.crashStatus === 'unsupported') {
    if (evidence.browserEvents.crashDetectionLimitationCode !== 'browser-crash-event-unavailable') {
      fail('Unsupported crash detection is missing its fixed reason');
    }
  } else if (evidence.browserEvents.crashDetectionLimitationCode !== null) {
    fail('Observed crash detection has an unsupported reason');
  }
  if (evidence.verdict.crash.status === 'unsupported') {
    if (evidence.verdict.crash.reasonCode !== 'browser-crash-event-unavailable') {
      fail('Unsupported crash verdict is missing its fixed reason');
    }
  } else if (evidence.verdict.crash.reasonCode !== null) {
    fail('Observed crash verdict has an unsupported reason');
  }
  const serialized = JSON.stringify(evidence);
  if (/(?:[A-Za-z]:\\Users\\[^\\"]+|\/Users\/[^/"]+|\/home\/[^/"]+)/.test(serialized)) {
    fail('Public evidence contains an absolute user path');
  }
  if (/Synthetic Web Stress Project|Stress Object|sessionId|webSocketDebuggerUrl/i.test(serialized)) {
    fail('Public evidence contains forbidden project or automation data');
  }
  const forbiddenKeys = new Set([
    'hostname', 'username', 'executable', 'profilePath', 'repositoryRoot', 'unmaskedVendor',
    'unmaskedRenderer', 'processInfo', 'processNames', 'project', 'projectName', 'commandLine', 'secret'
  ]);
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) fail(`Public evidence contains forbidden field: ${key}`);
      visit(item);
    }
  };
  visit(evidence);
  return evidence;
}

async function readEvidenceSchema(repositoryRoot) {
  const absolute = resolveInside(repositoryRoot, DEFAULT_EVIDENCE_SCHEMA_PATH, 'evidence schema');
  const stat = await fsp.lstat(absolute).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) fail(`Missing non-symlink evidence schema: ${DEFAULT_EVIDENCE_SCHEMA_PATH}`);
  try {
    return JSON.parse(await fsp.readFile(absolute, 'utf8'));
  } catch (error) {
    fail(`Invalid Web stress evidence schema JSON: ${error.message}`);
  }
}

function requestJson(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') fail('Automation HTTP is restricted to 127.0.0.1');
  return new Promise((resolve, reject) => {
    const request = http.request(parsed, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(options.body) } : undefined
    }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          request.destroy(new Error('Loopback automation response exceeded 4 MiB'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        let value = null;
        try { value = body ? JSON.parse(body) : null; } catch { value = body; }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(value);
        else reject(new Error(`Loopback automation HTTP ${response.statusCode}: ${sanitizeText(body)}`));
      });
    });
    const abortRequest = () => request.destroy(new Error('Loopback automation request was interrupted'));
    if (options.signal?.aborted) abortRequest();
    else options.signal?.addEventListener('abort', abortRequest, { once: true });
    request.once('close', () => options.signal?.removeEventListener('abort', abortRequest));
    request.once('error', reject);
    request.setTimeout(options.timeoutMs || 240000, () => request.destroy(new Error('Loopback automation request timed out')));
    if (options.body) request.write(options.body);
    request.end();
  });
}

class PipeCdpConnection {
  constructor(readable, writable) {
    this.readable = readable;
    this.writable = writable;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.buffer = '';
  }

  async open() {
    if (!this.readable || !this.writable) fail('Chromium did not expose the private CDP pipe');
    this.readable.setEncoding('utf8');
    this.readable.on('data', chunk => this.#data(chunk));
    this.readable.on('close', () => this.#closePending(new Error('CDP pipe closed')));
    this.readable.on('error', () => this.#closePending(new Error('CDP pipe failed')));
    this.writable.on('error', () => this.#closePending(new Error('CDP pipe failed')));
    return this;
  }

  #data(chunk) {
    this.buffer += chunk;
    let terminator;
    while ((terminator = this.buffer.indexOf('\0')) >= 0) {
      const raw = this.buffer.slice(0, terminator);
      this.buffer = this.buffer.slice(terminator + 1);
      if (raw) this.#message(raw);
    }
  }

  #message(raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`CDP ${pending.method} failed: ${message.error.message}`));
      else pending.resolve(message.result);
      return;
    }
    const listeners = this.listeners.get(message.method) || [];
    for (const listener of listeners) {
      if (!listener.sessionId || listener.sessionId === message.sessionId) listener.callback(message.params || {});
    }
  }

  #closePending(error) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  on(method, callback, sessionId = null) {
    const listeners = this.listeners.get(method) || [];
    const listener = { callback, sessionId };
    listeners.push(listener);
    this.listeners.set(method, listeners);
    return () => this.listeners.set(method, listeners.filter(item => item !== listener));
  }

  waitFor(method, milliseconds = 15000, sessionId = null) {
    return withTimeout(new Promise(resolve => {
      const remove = this.on(method, value => {
        remove();
        resolve(value);
      }, sessionId);
    }), milliseconds, method);
  }

  send(method, params = {}, milliseconds = 30000, sessionId = null) {
    if (this.closed || !this.writable.writable) return Promise.reject(new Error('CDP pipe is not open'));
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    this.writable.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    return withTimeout(promise, milliseconds, method).finally(() => this.pending.delete(id));
  }

  close() {
    this.#closePending(new Error('CDP pipe closed'));
    try { this.writable?.end(); } catch { /* best effort */ }
    try { this.readable?.destroy(); } catch { /* best effort */ }
  }
}

async function waitForChromiumTarget(connection, child, origin, spawnState) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (spawnState.error) fail(`Browser process failed to spawn: ${spawnState.error.code || 'spawn-error'}`);
    if (child.exitCode !== null) fail(`Browser exited before CDP became ready (exit ${child.exitCode})`);
    try {
      const { targetInfos = [] } = await connection.send('Target.getTargets');
      const page = targetInfos.find(target => target.type === 'page' && String(target.url).startsWith(origin));
      if (page?.targetId) return page;
    } catch {
      // The private pipe may need a moment after process creation.
    }
    await sleep(100);
  }
  fail('Chromium did not expose a page target');
}

async function terminateOwnedProcess(child, { processGroup = false, profilePath = null } = {}) {
  if (!child) return;
  const waitForExit = milliseconds => withTimeout(new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  }), milliseconds, 'owned browser process exit');
  if (!Number.isInteger(child.pid)) {
    await waitForExit(3000).catch(error => {
      if (child.exitCode === null && child.signalCode === null) throw error;
    });
    return;
  }
  if (process.platform === 'win32') {
    if (!profilePath) fail('Owned Windows Chromium cleanup requires its unique profile path');
    const killTree = async pid => {
      try {
        await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 10000 });
        return true;
      } catch {
        return false;
      }
    };
    // A crashed Chromium root can leave re-parented renderer or Crashpad processes alive.
    // Never taskkill a stale root PID after Node has observed its exit; instead, repeatedly
    // discover this run's processes by the random profile path embedded in their command line.
    if (child.exitCode === null && child.signalCode === null) await killTree(child.pid);
    const deadline = Date.now() + 10000;
    let quietSince = null;
    while (Date.now() < deadline) {
      const matching = await windowsOwnedProcessTable(profilePath);
      if (matching.length) {
        quietSince = null;
        for (const item of matching) await killTree(item.pid);
        await sleep(100);
        continue;
      }
      if (child.exitCode === null && child.signalCode === null) {
        quietSince = null;
        await killTree(child.pid);
        await sleep(100);
        continue;
      }
      quietSince ||= Date.now();
      if (Date.now() - quietSince >= 500) {
        await waitForExit(1000).catch(() => null);
        return;
      }
      await sleep(50);
    }
    const remaining = await windowsOwnedProcessTable(profilePath);
    if (remaining.length || (child.exitCode === null && child.signalCode === null)) {
      throw new Error('Owned Windows browser process tree could not be terminated');
    }
    return;
  }
  if (processGroup) {
    const groupHasLiveMembers = async () => {
      const { stdout } = await execFileAsync('ps', ['-axo', 'pgid=,state='], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
      return stdout.split(/\r?\n/).some(line => {
        const match = line.match(/^\s*(\d+)\s+(\S+)/);
        return match && Number(match[1]) === child.pid && !match[2].startsWith('Z');
      });
    };
    const waitForGroupExit = async milliseconds => {
      const deadline = Date.now() + milliseconds;
      while (Date.now() < deadline) {
        if (!await groupHasLiveMembers()) return true;
        await sleep(50);
      }
      return !await groupHasLiveMembers();
    };
    if (!await groupHasLiveMembers()) {
      await waitForExit(1000).catch(() => null);
      return;
    }
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
    if (await waitForGroupExit(3000)) {
      await waitForExit(1000).catch(() => null);
      return;
    }
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
    if (!await waitForGroupExit(3000)) throw new Error('Owned browser process group did not terminate');
    await waitForExit(1000).catch(() => null);
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { child.kill('SIGTERM'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
  try {
    await waitForExit(3000);
    return;
  } catch {
    if (child.exitCode !== null || child.signalCode !== null) return;
  }
  try { child.kill('SIGKILL'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
  await waitForExit(3000);
}

async function terminateOwnedCrashHelpers(profilePath) {
  if (process.platform !== 'darwin') return;
  const expectedDatabaseArgument = `--database=${path.join(profilePath, 'Library', 'Application Support', 'Google', 'Chrome', 'Crashpad')}`;
  const matchingHelpers = async () => {
    const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,state=,args='], { timeout: 5000, maxBuffer: 8 * 1024 * 1024 });
    return stdout.split(/\r?\n/).map(line => {
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/);
      if (!match || match[2].startsWith('Z')
        || !match[3].includes('chrome_crashpad_handler') || !match[3].includes(expectedDatabaseArgument)) return null;
      return Number(match[1]);
    }).filter(Number.isInteger);
  };
  const deadline = Date.now() + 5000;
  let quietSince = null;
  while (Date.now() < deadline) {
    const matching = await matchingHelpers();
    if (!matching.length) {
      quietSince ||= Date.now();
      if (Date.now() - quietSince >= 500) return;
      await sleep(50);
      continue;
    }
    quietSince = null;
    for (const pid of matching) {
      try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
    }
    await sleep(100);
    for (const pid of await matchingHelpers()) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
    }
    await sleep(100);
  }
  throw new Error('Owned Chrome crash helper did not remain absent for the cleanup window');
}

async function createOwnedTempDirectory(prefix) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  await fsp.chmod(directory, 0o700);
  const nonce = crypto.randomBytes(16).toString('hex');
  const marker = path.join(directory, '.prevision-web-stress-owner');
  await fsp.writeFile(marker, `${JSON.stringify({ schemaVersion: 1, nonce })}\n`, { flag: 'wx', mode: 0o600 });
  return { directory, marker, nonce };
}

async function removeOwnedTempDirectory(owned) {
  const stat = await fsp.lstat(owned.directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('Owned browser profile path became unsafe');
  const realDirectory = await fsp.realpath(owned.directory);
  const realTemp = await fsp.realpath(os.tmpdir());
  const relation = path.relative(realTemp, realDirectory);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) fail('Owned browser profile escaped the system temporary directory');
  const marker = JSON.parse(await fsp.readFile(owned.marker, 'utf8'));
  if (marker.schemaVersion !== 1 || marker.nonce !== owned.nonce) fail('Owned browser profile marker does not match');
  await fsp.rm(owned.directory, { recursive: true, force: false, maxRetries: 4, retryDelay: 100 });
}

async function launchChromium({ browser, executable, origin, viewport }) {
  const ownedProfile = await createOwnedTempDirectory(`prevision-${browser}-stress-`);
  const profilePath = ownedProfile.directory;
  const stderr = [];
  const args = [
    '--remote-debugging-pipe',
    `--user-data-dir=${profilePath}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-breakpad',
    '--disable-crash-reporter',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-sync',
    '--disable-features=AutofillServerCommunication,MediaRouter,OptimizationHints',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=127.0.0.1;localhost',
    '--metrics-recording-only',
    '--password-store=basic',
    '--use-mock-keychain',
    `--crash-dumps-dir=${path.join(profilePath, 'Crashpad')}`,
    `--window-size=${viewport.outerWidth},${viewport.outerHeight}`,
    origin
  ];
  const childEnvironment = {
    ...process.env,
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    ALL_PROXY: 'http://127.0.0.1:9',
    http_proxy: 'http://127.0.0.1:9',
    https_proxy: 'http://127.0.0.1:9',
    all_proxy: 'http://127.0.0.1:9',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
    ...(process.platform === 'darwin' ? { HOME: profilePath, CFFIXED_USER_HOME: profilePath } : {})
  };
  const child = spawn(executable, args, {
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    windowsHide: false,
    detached: process.platform !== 'win32',
    env: childEnvironment
  });
  const spawnState = { error: null };
  child.once('error', error => { spawnState.error = error; });
  child.stderr?.on('data', chunk => {
    if (stderr.length < 20) stderr.push(sanitizeText(chunk, [profilePath]));
  });
  let connection;
  try {
    connection = await new PipeCdpConnection(child.stdio[4], child.stdio[3]).open();
    const [version, target] = await Promise.all([
      connection.send('Browser.getVersion'),
      waitForChromiumTarget(connection, child, origin, spawnState)
    ]);
    const { sessionId } = await connection.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    if (!sessionId) fail('Chromium did not provide a flattened page session');
    const events = { consoleErrors: [], exceptions: [], crashed: false, detached: false };
    connection.on('Runtime.consoleAPICalled', event => {
      if (event.type !== 'error' && event.type !== 'warning') return;
      if (events.consoleErrors.length >= 40) return;
      events.consoleErrors.push(sanitizeText(event.args?.map(item => item.value ?? item.description ?? '').join(' '), [profilePath]));
    }, sessionId);
    connection.on('Runtime.exceptionThrown', event => {
      if (events.exceptions.length < 40) events.exceptions.push(sanitizeText(event.exceptionDetails?.text || 'Runtime exception', [profilePath]));
    }, sessionId);
    connection.on('Inspector.targetCrashed', () => { events.crashed = true; }, sessionId);
    connection.on('Inspector.detached', () => { events.detached = true; }, sessionId);
    await Promise.all([
      connection.send('Page.enable', {}, 30000, sessionId),
      connection.send('Runtime.enable', {}, 30000, sessionId),
      connection.send('Performance.enable', {}, 30000, sessionId),
      connection.send('Log.enable', {}, 30000, sessionId).catch(() => null),
      connection.send('Inspector.enable', {}, 30000, sessionId).catch(() => null)
    ]);
    await connection.send('Browser.setDownloadBehavior', { behavior: 'deny', eventsEnabled: true });
    const evaluate = async expression => {
      const response = await connection.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
      }, 240000, sessionId);
      if (response.exceptionDetails) {
        throw new Error(`Browser evaluation failed: ${response.exceptionDetails.text || response.result?.description || 'unknown exception'}`);
      }
      return response.result?.value;
    };
    return {
      browser,
      automation: 'cdp',
      version: version.Browser || safeBrowserVersion(executable, browser),
      pid: child.pid,
      child,
      supportsIsolatedRss: true,
      events,
      evaluate,
      applicationReady() {
        return evaluate("typeof newProject === 'function' && typeof renderer !== 'undefined' && Boolean(document.getElementById('viewport'))");
      },
      installStressBridge() {
        return evaluate(PAGE_BOOTSTRAP_SOURCE);
      },
      runScenario(id, config) {
        return evaluate(`globalThis.__previsionStress.run(${JSON.stringify(id)}, ${JSON.stringify(config)})`);
      },
      teardownStressBridge() {
        return evaluate("globalThis.__previsionStress ? globalThis.__previsionStress.teardown() : ({ cleaned: true, errorCodes: [] })");
      },
      async systemInfo() {
        const info = await connection.send('SystemInfo.getInfo').catch(error => ({ unavailableReason: error.message }));
        return classifyChromiumGpuInfo(info);
      },
      async close() {
        const cleanupErrors = [];
        if (process.platform !== 'win32') await connection.send('Browser.close').catch(() => null);
        connection.close();
        try { await terminateOwnedProcess(child, { processGroup: process.platform !== 'win32', profilePath }); } catch { cleanupErrors.push('owned-browser-process-not-terminated'); }
        try { await terminateOwnedCrashHelpers(profilePath); } catch { cleanupErrors.push('owned-crash-helper-not-terminated'); }
        try { await removeOwnedTempDirectory(ownedProfile); } catch { cleanupErrors.push('owned-browser-profile-not-removed'); }
        if (cleanupErrors.length) throw new Error(cleanupErrors.join(','));
      },
      privateRoots: [profilePath],
      stderr
    };
  } catch (error) {
    connection?.close();
    const cleanupErrors = [];
    try { await terminateOwnedProcess(child, { processGroup: process.platform !== 'win32', profilePath }); } catch { cleanupErrors.push('owned-browser-process-not-terminated'); }
    try { await terminateOwnedCrashHelpers(profilePath); } catch { cleanupErrors.push('owned-crash-helper-not-terminated'); }
    try { await removeOwnedTempDirectory(ownedProfile); } catch { cleanupErrors.push('owned-browser-profile-not-removed'); }
    const suffix = cleanupErrors.length ? `; launch cleanup failures: ${cleanupErrors.join(',')}` : '';
    throw new Error(`${error.message}${suffix}`);
  }
}

async function reserveLoopbackPort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForWebDriver(port, child, spawnState, signal) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (signal?.aborted) fail('Web stress run was interrupted');
    if (spawnState.error) fail(`safaridriver failed to spawn: ${spawnState.error.code || 'spawn-error'}`);
    if (child.exitCode !== null) fail(`safaridriver exited before becoming ready (exit ${child.exitCode})`);
    try {
      await requestJson(`http://127.0.0.1:${port}/status`, { signal });
      return;
    } catch {
      await sleep(150);
    }
  }
  fail('safaridriver did not become ready; Safari Remote Automation may not be enabled');
}

async function launchSafari({ executable, origin, viewport, signal }) {
  const port = await reserveLoopbackPort();
  const stderr = [];
  const child = spawn(executable, ['-p', String(port)], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: false });
  const spawnState = { error: null };
  child.once('error', error => { spawnState.error = error; });
  child.stderr?.on('data', chunk => {
    if (stderr.length < 20) stderr.push(sanitizeText(chunk));
  });
  let sessionId;
  try {
    await waitForWebDriver(port, child, spawnState, signal);
    const created = await requestJson(`http://127.0.0.1:${port}/session`, {
      method: 'POST',
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: 'safari'
          }
        }
      }),
      signal
    });
    sessionId = created?.value?.sessionId || created?.sessionId;
    const capabilities = created?.value?.capabilities || created?.value || {};
    if (!sessionId) fail('safaridriver did not return a WebDriver session id');
    const endpoint = suffix => `http://127.0.0.1:${port}/session/${encodeURIComponent(sessionId)}${suffix}`;
    await requestJson(endpoint('/timeouts'), {
      method: 'POST',
      body: JSON.stringify({ script: 240000, pageLoad: 60000, implicit: 0 }),
      signal
    });
    await requestJson(endpoint('/window/rect'), {
      method: 'POST',
      body: JSON.stringify({ width: viewport.outerWidth, height: viewport.outerHeight, x: 30, y: 30 }),
      signal
    }).catch(() => null);
    await requestJson(endpoint('/url'), { method: 'POST', body: JSON.stringify({ url: origin }), signal });
    const executeAsync = async (body, args = [], requestSignal = signal) => {
      const response = await requestJson(endpoint('/execute/async'), {
        method: 'POST',
        body: JSON.stringify({
          script: [
            'const done = arguments[arguments.length - 1];',
            `Promise.resolve().then(async () => (${body})).then(`,
            '  value => done({ ok: true, value }),',
            '  error => done({ ok: false, error: String(error && error.message || error) })',
            ');'
          ].join('\n'),
          args
        }),
        signal: requestSignal
      });
      if (!response?.value?.ok) throw new Error(`Safari evaluation failed: ${response?.value?.error || 'unknown error'}`);
      return response.value.value;
    };
    return {
      browser: 'safari',
      automation: 'webdriver',
      version: capabilities.browserVersion || safeBrowserVersion(executable, 'safari'),
      pid: child.pid,
      child,
      supportsIsolatedRss: false,
      events: {
        consoleErrors: [],
        exceptions: [],
        crashed: false,
        detached: false,
        consoleCollectionUnavailableReason: 'Safari WebDriver does not expose CDP console events to this zero-dependency harness.',
        crashDetectionUnavailableReason: 'Safari WebDriver does not expose a reliable Safari/WebContent crash event; command failures remain visible as scenario failures.'
      },
      applicationReady() {
        return executeAsync("typeof newProject === 'function' && typeof renderer !== 'undefined' && Boolean(document.getElementById('viewport'))");
      },
      installStressBridge() {
        return executeAsync(PAGE_BOOTSTRAP_SOURCE);
      },
      runScenario(id, config) {
        return executeAsync('globalThis.__previsionStress.run(arguments[0], arguments[1])', [id, config]);
      },
      teardownStressBridge() {
        return executeAsync(
          "globalThis.__previsionStress ? globalThis.__previsionStress.teardown() : ({ cleaned: true, errorCodes: [] })",
          [],
          null
        );
      },
      async systemInfo() {
        return {
          status: 'unsupported',
          source: 'webdriver',
          reason: 'Safari WebDriver does not expose browser-process GPU diagnostics; page WebGL limits are recorded instead.'
        };
      },
      async close() {
        let closeError = null;
        if (sessionId) {
          try {
            await requestJson(endpoint(''), { method: 'DELETE' });
          } catch (error) {
            closeError = new Error('Safari WebDriver session could not be deleted cleanly');
          }
          sessionId = null;
        }
        await terminateOwnedProcess(child);
        if (closeError) throw closeError;
      },
      privateRoots: [],
      stderr
    };
  } catch (error) {
    const cleanupErrors = [];
    if (sessionId) {
      try {
        await requestJson(`http://127.0.0.1:${port}/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      } catch {
        cleanupErrors.push('safari-session-not-deleted');
      }
    }
    try { await terminateOwnedProcess(child); } catch { cleanupErrors.push('safaridriver-not-terminated'); }
    const suffix = cleanupErrors.length ? `; launch cleanup failures: ${cleanupErrors.join(',')}` : '';
    throw new Error(`${error.message}${suffix}`);
  }
}

async function unixProcessTable() {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,rss=,comm='], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
  return stdout.split(/\r?\n/).map(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) return null;
    return { pid: Number(match[1]), ppid: Number(match[2]), memoryBytes: Number(match[3]) * 1024, name: path.basename(match[4]) };
  }).filter(Boolean);
}

async function windowsProcessTable() {
  const command = [
    '$ErrorActionPreference="Stop";',
    'Get-CimInstance Win32_Process |',
    'Select-Object ProcessId,ParentProcessId,WorkingSetSize,Name |',
    'ConvertTo-Json -Compress'
  ].join(' ');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024
  });
  const parsed = JSON.parse(stdout || '[]');
  return (Array.isArray(parsed) ? parsed : [parsed]).map(item => ({
    pid: Number(item.ProcessId),
    ppid: Number(item.ParentProcessId),
    memoryBytes: Number(item.WorkingSetSize || 0),
    name: String(item.Name || '')
  }));
}

export function selectOwnedWindowsProcesses(processes, profilePath) {
  const normalizedProfile = String(profilePath || '').replaceAll('/', '\\').toLowerCase();
  const profileName = path.win32.basename(normalizedProfile);
  if (!path.win32.isAbsolute(normalizedProfile) || !/^prevision-(?:chrome|edge)-stress-[a-z0-9_-]{6,}$/.test(profileName)) {
    fail('Owned Windows browser profile path is not a recognized stress profile');
  }
  return processes.filter(item => {
    const commandLine = String(item.commandLine || '').replaceAll('/', '\\').toLowerCase();
    let index = commandLine.indexOf(normalizedProfile);
    while (index >= 0) {
      const next = commandLine[index + normalizedProfile.length] || '';
      if (!next || ['\\', '"', "'", ' ', ';'].includes(next)) return Number.isInteger(item.pid) && item.pid > 0;
      index = commandLine.indexOf(normalizedProfile, index + 1);
    }
    return false;
  });
}

async function windowsOwnedProcessTable(profilePath) {
  const command = [
    '$ErrorActionPreference="Stop";',
    '$ownedProfile=[Environment]::GetEnvironmentVariable("PREVISION_STRESS_OWNED_PROFILE");',
    'if ([String]::IsNullOrWhiteSpace($ownedProfile)) { throw "Missing owned profile" };',
    '@(Get-CimInstance Win32_Process |',
    'Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($ownedProfile, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |',
    'Select-Object ProcessId,ParentProcessId,Name,CommandLine) |',
    'ConvertTo-Json -Compress'
  ].join(' ');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PREVISION_STRESS_OWNED_PROFILE: profilePath }
  });
  const parsed = JSON.parse(stdout || '[]');
  const processes = (Array.isArray(parsed) ? parsed : [parsed]).map(item => ({
    pid: Number(item.ProcessId),
    ppid: Number(item.ParentProcessId),
    name: String(item.Name || ''),
    commandLine: String(item.CommandLine || '')
  }));
  return selectOwnedWindowsProcesses(processes, profilePath);
}

export function aggregateProcessTree(processes, rootPid) {
  const descendants = new Set([Number(rootPid)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes) {
      if (descendants.has(process.ppid) && !descendants.has(process.pid)) {
        descendants.add(process.pid);
        changed = true;
      }
    }
  }
  const selected = processes.filter(process => descendants.has(process.pid));
  return {
    memoryBytes: selected.reduce((sum, process) => sum + Math.max(0, process.memoryBytes || 0), 0),
    processCount: selected.length
  };
}

async function sampleOwnedProcessTree(rootPid) {
  const processes = process.platform === 'win32' ? await windowsProcessTable() : await unixProcessTable();
  return aggregateProcessTree(processes, rootPid);
}

function startProcessSampler(rootPid, intervalMs) {
  const samples = [];
  const effectiveIntervalMs = process.platform === 'win32' ? Math.max(2000, intervalMs) : Math.max(100, intervalMs);
  let stopped = false;
  let busy = false;
  let timer;
  const take = async (force = false) => {
    if ((stopped && !force) || busy) return;
    busy = true;
    try {
      const value = await sampleOwnedProcessTree(rootPid);
      samples.push({ atEpochMs: Date.now(), ...value });
    } catch (error) {
      samples.push({ atEpochMs: Date.now(), memoryBytes: null, processCount: null, errorCode: 'process-memory-sample-failed' });
    } finally {
      busy = false;
    }
  };
  timer = setInterval(take, effectiveIntervalMs);
  take();
  return {
    samples,
    effectiveIntervalMs,
    methodOverhead: process.platform === 'win32'
      ? 'powershell-cim-process-table-every-2s-or-slower'
      : 'posix-ps-process-table',
    async stop() {
      stopped = true;
      clearInterval(timer);
      while (busy) await sleep(20);
      await take(true);
    }
  };
}

async function browserStressBootstrap(validateSyntheticFixture, createSyntheticOracle, validateSyntheticActiveScene) {
  if (globalThis.__previsionStress) return globalThis.__previsionStress.describe();
  const state = {
    schemaVersion: 1,
    outputs: [],
    alertCount: 0,
    contextLost: 0,
    contextRestored: 0,
    attachedCanvases: 0,
    errorCodes: [],
    baselineFrameMs: null,
    nextOutputSequence: 1
  };
  const original = {
    dl,
    alert: globalThis.alert,
    anchorClick: HTMLAnchorElement.prototype.click,
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
    configureRenderer
  };
  const objectUrls = new Map();
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFrames = async count => {
    for (let index = 0; index < count; index += 1) await nextFrame();
  };
  const waitFor = async (predicate, timeoutMs, label) => {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      if (await predicate()) return;
      await wait(50);
    }
    throw new Error(`${label} timed out`);
  };
  const attachCanvas = canvas => {
    if (!canvas || canvas.dataset.previsionStressObserved === '1') return;
    canvas.dataset.previsionStressObserved = '1';
    state.attachedCanvases += 1;
    canvas.addEventListener('webglcontextlost', () => { state.contextLost += 1; });
    canvas.addEventListener('webglcontextrestored', () => { state.contextRestored += 1; });
  };
  document.querySelectorAll('canvas').forEach(attachCanvas);
  const canvasObserver = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof HTMLCanvasElement) attachCanvas(node);
    node.querySelectorAll?.('canvas').forEach(attachCanvas);
  })));
  canvasObserver.observe(document.documentElement, { childList: true, subtree: true });
  try {
    configureRenderer = rendererInstance => {
      const configured = original.configureRenderer(rendererInstance);
      attachCanvas(configured?.domElement);
      return configured;
    };
  } catch {
    state.errorCodes.push('renderer-observer-install-failed');
  }
  globalThis.alert = () => { state.alertCount += 1; };
  URL.createObjectURL = blob => {
    const url = original.createObjectURL(blob);
    objectUrls.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = url => {
    objectUrls.delete(String(url));
    return original.revokeObjectURL(url);
  };
  const outputKind = name => {
    const value = String(name || '').toLowerCase();
    if (value.startsWith('seedance_') && value.endsWith('.zip')) return 'seedance-zip';
    if (value.endsWith('.png')) return 'screenshot-png';
    if (value.endsWith('.zip')) return 'zip';
    if (value.endsWith('.mp4') || value.endsWith('.webm')) return 'video';
    return 'other';
  };
  const publicOutput = output => output && ({
    sequence: output.sequence,
    kind: output.kind,
    size: output.size,
    type: output.type,
    validation: output.validation
  });
  const pngValidation = payload => {
    try {
      const decoded = atob(payload.slice(0, 48));
      const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const signatureValid = signature.every((value, index) => bytes[index] === value);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {
        status: signatureValid && bytes.length >= 24 ? 'passed' : 'failed',
        format: 'png',
        signatureValid,
        width: bytes.length >= 24 ? view.getUint32(16) : null,
        height: bytes.length >= 24 ? view.getUint32(20) : null
      };
    } catch {
      return { status: 'failed', format: 'png', signatureValid: false, width: null, height: null };
    }
  };
  const videoValidation = async blob => {
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const mp4 = bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
    const webm = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    return {
      status: blob.size > 0 && (mp4 || webm) ? 'passed' : 'failed',
      format: mp4 ? 'mp4' : webm ? 'webm' : 'unknown',
      signatureValid: mp4 || webm
    };
  };
  const zipValidation = async blob => {
    const first = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const signatureValid = first[0] === 0x50 && first[1] === 0x4b && first[2] === 0x03 && first[3] === 0x04;
    const tailStart = Math.max(0, blob.size - 65557);
    const tail = new Uint8Array(await blob.slice(tailStart).arrayBuffer());
    let entryCount = null;
    let centralOffset = null;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail[index] === 0x50 && tail[index + 1] === 0x4b && tail[index + 2] === 0x05 && tail[index + 3] === 0x06) {
        const view = new DataView(tail.buffer, tail.byteOffset + index, 22);
        entryCount = view.getUint16(10, true);
        centralOffset = view.getUint32(16, true);
        break;
      }
    }
    const entries = [];
    if (entryCount !== null && centralOffset !== null && centralOffset >= tailStart) {
      let cursor = centralOffset - tailStart;
      const decoder = new TextDecoder();
      for (let index = 0; index < entryCount; index += 1) {
        if (cursor + 46 > tail.length) break;
        const view = new DataView(tail.buffer, tail.byteOffset + cursor, 46);
        if (view.getUint32(0, true) !== 0x02014b50) break;
        const nameLength = view.getUint16(28, true);
        const extraLength = view.getUint16(30, true);
        const commentLength = view.getUint16(32, true);
        const nameEnd = cursor + 46 + nameLength;
        if (nameEnd > tail.length) break;
        entries.push({
          name: decoder.decode(tail.slice(cursor + 46, nameEnd)),
          uncompressedSize: view.getUint32(24, true),
          localOffset: view.getUint32(42, true)
        });
        cursor = nameEnd + extraLength + commentLength;
      }
    }
    const expectedNames = [
      /^01_previz_refvideo\.(?:mp4|webm)$/,
      /^02_firstframe\.png$/,
      /^03_lastframe\.png$/,
      /^04_prompt\.txt$/,
      /^05_shotdata\.json$/
    ];
    const expectedEntriesPresent = entries.length === expectedNames.length
      && entries.every((entry, index) => expectedNames[index].test(entry.name));
    const allEntriesNonEmpty = entries.length === expectedNames.length
      && entries.every(entry => entry.uncompressedSize > 0 && entry.localOffset < centralOffset);
    const passed = signatureValid && entryCount === 5 && expectedEntriesPresent && allEntriesNonEmpty;
    return {
      status: passed ? 'passed' : 'failed',
      format: 'zip',
      signatureValid,
      centralDirectoryFound: entryCount !== null,
      entryCount,
      expectedEntriesPresent,
      allEntriesNonEmpty
    };
  };
  try {
    dl = async (url, name) => {
      const value = String(url);
      if (!value.startsWith('data:') && !value.startsWith('blob:')) throw new Error('stress-download-scheme-rejected');
      let size = 0;
      let type = null;
      let dataPayload = null;
      const sourceBlob = objectUrls.get(value);
      if (sourceBlob) {
        size = sourceBlob.size;
        type = sourceBlob.type || null;
      } else if (value.startsWith('data:')) {
        const comma = value.indexOf(',');
        const metadata = value.slice(5, comma);
        const payload = value.slice(comma + 1);
        dataPayload = metadata.includes(';base64') ? payload : null;
        type = metadata.split(';', 1)[0] || null;
        size = metadata.includes(';base64')
          ? Math.max(0, Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0))
          : new TextEncoder().encode(decodeURIComponent(payload)).length;
      } else {
        throw new Error('stress-download-blob-not-owned');
      }
      const kind = outputKind(name);
      let validation = { status: 'not-applicable' };
      if (kind === 'screenshot-png') validation = dataPayload ? pngValidation(dataPayload) : { status: 'failed', format: 'png', signatureValid: false };
      else if ((kind === 'seedance-zip' || kind === 'zip') && sourceBlob) validation = await zipValidation(sourceBlob);
      else if (kind === 'video' && sourceBlob) validation = await videoValidation(sourceBlob);
      const output = { sequence: state.nextOutputSequence++, kind, size, type, validation };
      state.outputs.push(output);
      if (value.startsWith('blob:')) URL.revokeObjectURL(value);
      return { canceled: false, capturedByHarness: true };
    };
  } catch (error) {
    state.errorCodes.push('download-interception-install-failed');
  }
  HTMLAnchorElement.prototype.click = function guardedStressAnchorClick() {
    const href = String(this.href || '');
    if (this.download && (href.startsWith('data:') || href.startsWith('blob:'))) {
      state.errorCodes.push('native-download-guard-used');
      return;
    }
    return original.anchorClick.call(this);
  };
  await dl('data:text/plain;base64,cHJvYmU=', 'probe.txt');
  if (state.outputs.at(-1)?.size !== 5) throw new Error('Download interception self-test failed');
  state.outputs.length = 0;
  state.nextOutputSequence = 1;
  const navigationTiming = () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map(entry => [entry.name, entry.startTime]));
    if (!navigation) return null;
    return {
      responseStartMs: navigation.responseStart,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadEventMs: navigation.loadEventEnd,
      transferSize: navigation.transferSize,
      encodedBodySize: navigation.encodedBodySize,
      decodedBodySize: navigation.decodedBodySize,
      firstPaintMs: paint['first-paint'] ?? null,
      firstContentfulPaintMs: paint['first-contentful-paint'] ?? null
    };
  };
  const rendererMetrics = () => {
    try {
      const info = renderer.info;
      return {
        memory: { geometries: info.memory.geometries, textures: info.memory.textures },
        render: {
          calls: info.render.calls,
          triangles: info.render.triangles,
          points: info.render.points,
          lines: info.render.lines
        }
      };
    } catch (error) {
      return { unavailableReason: error.message };
    }
  };
  const webglMetrics = () => {
    try {
      const gl = renderer.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
        maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
        antialias: gl.getContextAttributes()?.antialias ?? null,
        contextLost: gl.isContextLost()
      };
    } catch (error) {
      return { unavailableReason: error.message };
    }
  };
  const pageMetrics = () => {
    const memory = performance.memory
      ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        }
      : null;
    return {
      atMs: performance.now(),
      jsHeap: memory,
      jsHeapUnavailableReason: memory ? null : 'performance.memory is not exposed by this browser',
      renderer: rendererMetrics(),
      webgl: webglMetrics(),
      domNodes: document.getElementsByTagName('*').length,
      canvases: document.querySelectorAll('canvas').length,
      viewport: {
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visibilityState: document.visibilityState,
        canvasPixels: [...document.querySelectorAll('canvas')].map(canvas => ({
          id: canvas.id || 'anonymous',
          width: canvas.width,
          height: canvas.height
        }))
      },
      captureCapabilities: {
        mediaRecorder: typeof MediaRecorder === 'function',
        canvasCaptureStream: typeof HTMLCanvasElement.prototype.captureStream === 'function',
        requestFrame: (() => {
          try {
            const canvas = document.createElement('canvas');
            const stream = canvas.captureStream?.(0);
            const supported = typeof stream?.getVideoTracks?.()[0]?.requestFrame === 'function';
            stream?.getTracks?.().forEach(track => track.stop());
            return supported;
          } catch { return false; }
        })()
      },
      contextLost: state.contextLost,
      contextRestored: state.contextRestored
    };
  };
  const measureFps = (durationMs, onMeasurementStart = null) => new Promise((resolve, reject) => {
    const deltas = [];
    const visibilityChanges = [];
    const onVisibility = () => visibilityChanges.push({ atMs: performance.now(), state: document.visibilityState });
    document.addEventListener('visibilitychange', onVisibility);
    let started = 0;
    let measurementStarted = 0;
    let previous = 0;
    let warmup = 10;
    const frame = timestamp => {
      if (!started) { started = timestamp; previous = timestamp; }
      else {
        const delta = timestamp - previous;
        previous = timestamp;
        if (warmup > 0) {
          warmup -= 1;
          if (warmup === 0) {
            measurementStarted = timestamp;
            try {
              onMeasurementStart?.();
            } catch (error) {
              document.removeEventListener('visibilitychange', onVisibility);
              reject(error);
              return;
            }
          }
        } else deltas.push(delta);
      }
      if (!measurementStarted || timestamp - measurementStarted < durationMs) requestAnimationFrame(frame);
      else {
        document.removeEventListener('visibilitychange', onVisibility);
        const elapsed = Math.max(1, timestamp - measurementStarted);
        const sorted = [...deltas].sort((left, right) => left - right);
        const percentile = value => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] : null;
        const observedBaseline = state.baselineFrameMs || percentile(.5);
        const missed = observedBaseline
          ? deltas.reduce((sum, delta) => sum + Math.max(0, Math.round(delta / observedBaseline) - 1), 0)
          : null;
        resolve({
          durationMs: elapsed,
          frames: deltas.length,
          fps: deltas.length / elapsed * 1000,
          baselineFrameMs: observedBaseline,
          missedVsyncEstimate: missed,
          estimateMethod: observedBaseline ? 'measured-idle-rAF-baseline' : 'unavailable',
          over33ms: deltas.filter(value => value > 33.3).length,
          over50ms: deltas.filter(value => value > 50).length,
          p50FrameMs: percentile(.5),
          p95FrameMs: percentile(.95),
          p99FrameMs: percentile(.99),
          maxFrameMs: sorted.length ? sorted[sorted.length - 1] : null,
          valid: document.visibilityState === 'visible' && visibilityChanges.length === 0,
          visibilityChanges
        });
      }
    };
    requestAnimationFrame(frame);
  });
  const syntheticActor = (index, count) => {
    const kinds = ['char', 'prop', 'car', 'tree', 'rock', 'bush', 'house', 'pillar', 'dog', 'horse', 'wall', 'prop'];
    const columns = 6;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = (column - 2.5) * 3.1;
    const z = (row - Math.floor(count / columns) / 2) * 3.4;
    return {
      kind: kinds[index % kinds.length],
      label: `Stress Object ${String(index + 1).padStart(2, '0')}`,
      pos: [x, z],
      rotY: (index % 8) * 15,
      path: index % 3 === 0 ? [[x, z], [x + 1.2, z + .7], [x + 2, z - .5]] : []
    };
  };
  let syntheticSceneOracle = null;
  const prepareTypicalProject = config => {
    const data = newProject();
    data.name = 'Synthetic Web Stress Project';
    data.settings = { collision: true, labels: true };
    const base = data.scenes[0];
    base.name = 'Synthetic Stress Scene 1';
    base.actors = Array.from({ length: config.objectCount }, (_, index) => syntheticActor(index, config.objectCount));
    data.scenes = Array.from({ length: config.sceneCount }, (_, sceneIndex) => {
      const sceneData = deepCopy(base);
      sceneData.name = `Synthetic Stress Scene ${sceneIndex + 1}`;
      sceneData.actors.forEach((actor, actorIndex) => {
        actor.pos = [actor.pos[0] + sceneIndex * .25, actor.pos[1] + (actorIndex % 2 ? .2 : -.2) * sceneIndex];
        actor.path = (actor.path || []).map(point => [point[0] + sceneIndex * .25, point[1]]);
      });
      sceneData.shots.forEach((shot, shotIndex) => {
        shot.lock = sceneData.actors[shotIndex % sceneData.actors.length].label;
        shot.syncActor = '';
      });
      return sceneData;
    });
    validateSyntheticFixture(data, config);
    syntheticSceneOracle = createSyntheticOracle(data);
    const alertCountBefore = state.alertCount;
    if (openProjectData(data) !== true) throw new Error('Synthetic stress project was rejected by the application');
    if (state.alertCount !== alertCountBefore) throw new Error('Synthetic stress project displayed an alert while loading');
    const runtimeDetails = validateSyntheticFixture(project, config);
    if (actors.length !== config.objectCount) throw new Error('Synthetic stress project did not activate the expected runtime actors');
    if (dirtyTimer) clearTimeout(dirtyTimer);
    dirtyTimer = null;
    localStorage.removeItem(AUTOSAVE_KEY);
    return runtimeDetails;
  };
  const verifyActiveSyntheticScene = (config, expectedSceneIndex, context) => {
    validateSyntheticFixture(project, config.typicalScene);
    return validateSyntheticActiveScene(syntheticSceneOracle, project, actors, expectedSceneIndex, sceneIdx, context);
  };
  const scenario = {
    async 'default-load'() {
      await waitFrames(4);
      const idleFps = await measureFps(1200);
      if (!idleFps.valid) throw new Error('Idle FPS sample was invalid because page visibility changed');
      state.baselineFrameMs = idleFps.p50FrameMs;
      return { navigation: navigationTiming(), idleFps, sceneCount: project.scenes.length, objectCount: actors.length };
    },
    async 'typical-multi-object'(config) {
      const details = prepareTypicalProject(config.typicalScene);
      await waitFrames(8);
      return details;
    },
    async 'panorama-4096x2048'(config) {
      const canvas = document.createElement('canvas');
      canvas.width = config.panorama.width;
      canvas.height = config.panorama.height;
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1a3359');
      gradient.addColorStop(.48, '#d18e56');
      gradient.addColorStop(.52, '#8b6848');
      gradient.addColorStop(1, '#251f1d');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 0; x < canvas.width; x += 256) context.fillRect(x, canvas.height * .49, 128, 6);
      const dataUrl = canvas.toDataURL('image/jpeg', .9);
      const asset = addAsset(dataUrl, canvas.width, canvas.height);
      curScene().bg = { asset, yaw: 0, y: 1.6, radius: 60, gp: true };
      buildSky();
      const texture = assetTexture(asset);
      if (texture?.image?.decode) await texture.image.decode().catch(() => {});
      else await waitFor(() => texture?.image?.complete, 15000, 'panorama decode');
      await waitFrames(8);
      const gl = renderer.getContext();
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (!texture?.image?.complete || texture.image.naturalWidth !== canvas.width || texture.image.naturalHeight !== canvas.height) {
        throw new Error('Panorama did not decode at the requested 4096x2048 dimensions');
      }
      if (maxTextureSize < canvas.width) throw new Error('WebGL MAX_TEXTURE_SIZE is below 4096');
      return {
        width: canvas.width,
        height: canvas.height,
        encodedBytes: Math.round(dataUrl.length * .75),
        textureReady: true,
        naturalWidth: texture.image.naturalWidth,
        naturalHeight: texture.image.naturalHeight,
        maxTextureSize
      };
    },
    async 'repeated-scene-switch'(config) {
      const started = performance.now();
      const verifiedSceneIndexes = new Set();
      for (let index = 0; index < config.profile.sceneSwitchIterations; index += 1) {
        const expectedSceneIndex = index % project.scenes.length;
        loadScene(expectedSceneIndex);
        await waitFrames(2);
        verifyActiveSyntheticScene(config, expectedSceneIndex, `switch ${index + 1}`);
        verifiedSceneIndexes.add(expectedSceneIndex);
      }
      if (verifiedSceneIndexes.size !== config.typicalScene.sceneCount) {
        throw new Error('Repeated scene switching did not verify every synthetic scene identity');
      }
      return {
        iterations: config.profile.sceneSwitchIterations,
        durationMs: performance.now() - started,
        finalSceneIndex: sceneIdx,
        sceneCount: verifiedSceneIndexes.size,
        objectCount: config.typicalScene.objectCount
      };
    },
    async 'short-shot-playback'(config) {
      setShot(0, true);
      const previousDuration = curShot().dur;
      const measuredDurationSeconds = Math.min(2, previousDuration, config.profile.playbackMs / 1000);
      curShot().dur = measuredDurationSeconds;
      const started = performance.now();
      try {
        const playButton = document.getElementById('playShot');
        if (!playButton) throw new Error('Playback control is missing');
        let notifyPlaybackStarted;
        let rejectPlaybackStarted;
        const playbackStarted = new Promise((resolve, reject) => {
          notifyPlaybackStarted = resolve;
          rejectPlaybackStarted = reject;
        });
        const fpsPromise = measureFps(
          Math.min(config.profile.fpsSampleMs, measuredDurationSeconds * 1000),
          () => {
            playButton.click();
            notifyPlaybackStarted();
          }
        );
        fpsPromise.catch(rejectPlaybackStarted);
        await playbackStarted;
        await waitFor(() => !playing, curShot().dur * 1000 + 5000, 'short playback');
        const fps = await fpsPromise;
        if (!fps.valid) throw new Error('Playback FPS sample was invalid because page visibility changed');
        return { fps, configuredShotDurationSeconds: measuredDurationSeconds, wallDurationMs: performance.now() - started };
      } finally {
        playing = false;
        curShot().dur = previousDuration;
        updatePlayBtn();
      }
    },
    async 'screenshot-export'() {
      const start = state.outputs.length;
      document.getElementById('snap').click();
      await waitFor(() => state.outputs.length > start, 30000, 'screenshot export');
      const output = state.outputs[state.outputs.length - 1];
      if (output.kind !== 'screenshot-png' || output.size <= 0 || output.type !== 'image/png' || output.validation?.status !== 'passed') {
        throw new Error('Screenshot export did not produce a valid non-empty PNG');
      }
      return { output: publicOutput(output) };
    },
    async 'short-recording'(config) {
      const blob = await recordBlob(config.profile.recordingSeconds, () => {
        time = 0;
        playAllMode = false;
      });
      const validation = await videoValidation(blob);
      if (blob.size <= 0 || !String(blob.type || '').startsWith('video/') || validation.status !== 'passed') {
        throw new Error('Short recording did not produce a valid non-empty video container');
      }
      return {
        durationSeconds: config.profile.recordingSeconds,
        output: {
          kind: 'recording-video', size: blob.size, type: blob.type,
          extension: blob.ext || null, validation
        }
      };
    },
    async 'seedance-export'(config) {
      const button = document.getElementById('seedancePack');
      const previousDuration = curShot().dur;
      const start = state.outputs.length;
      curShot().dur = config.profile.recordingSeconds;
      try {
        button.click();
        await waitFor(() => !button.disabled && state.outputs.length > start, 120000, 'Seedance export');
        const output = state.outputs[state.outputs.length - 1];
        if (output.kind !== 'seedance-zip' || output.size <= 0 || output.validation?.status !== 'passed') {
          throw new Error('Seedance ZIP was not captured with the expected five-entry structure');
        }
        return { durationSeconds: config.profile.recordingSeconds, output: publicOutput(output) };
      } finally {
        curShot().dur = previousDuration;
      }
    },
    async 'long-session'(config) {
      const before = pageMetrics();
      let notifyMeasurementStarted;
      const measurementStarted = new Promise(resolve => { notifyMeasurementStarted = resolve; });
      const fpsPromise = measureFps(config.profile.longSessionDurationMs, notifyMeasurementStarted);
      await measurementStarted;
      const deadline = performance.now() + config.profile.longSessionDurationMs;
      let cycles = 0;
      const verifiedSceneIndexes = new Set();
      while (performance.now() < deadline) {
        const expectedSceneIndex = cycles % project.scenes.length;
        loadScene(expectedSceneIndex);
        verifyActiveSyntheticScene(config, expectedSceneIndex, `long-session cycle ${cycles + 1}`);
        verifiedSceneIndexes.add(expectedSceneIndex);
        setShot(cycles % shots.length, true);
        playing = true;
        await wait(Math.min(config.profile.longSessionActionIntervalMs, Math.max(1, deadline - performance.now())));
        playing = false;
        cycles += 1;
      }
      if (verifiedSceneIndexes.size !== config.typicalScene.sceneCount) {
        throw new Error('Long session did not verify every synthetic scene identity');
      }
      const fps = await fpsPromise;
      if (!fps.valid) throw new Error('Long-session FPS sample was invalid because page visibility changed');
      await wait(config.profile.cooldownMs);
      const after = pageMetrics();
      return {
        observationDurationMs: config.profile.longSessionDurationMs,
        cycles,
        fps,
        before,
        after,
        usedJSHeapDelta: before.jsHeap && after.jsHeap ? after.jsHeap.usedJSHeapSize - before.jsHeap.usedJSHeapSize : null,
        sceneCount: verifiedSceneIndexes.size,
        objectCount: config.typicalScene.objectCount
      };
    }
  };
  globalThis.__previsionStress = {
    describe() {
      return { schemaVersion: 1, ready: true, navigation: navigationTiming(), page: pageMetrics() };
    },
    async run(id, config) {
      if (!scenario[id]) throw new Error(`Unknown stress scenario: ${id}`);
      const started = performance.now();
      const before = pageMetrics();
      const alertCountBefore = state.alertCount;
      const heapSamples = [];
      const heapTimer = setInterval(() => {
        if (performance.memory) heapSamples.push({
          atMs: performance.now(),
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        });
      }, Math.max(100, config.profile.memorySampleMs));
      let details;
      let status = 'passed';
      let error = null;
      let failureReasonCode = null;
      try {
        details = await scenario[id](config);
        await wait(config.profile.settleMs);
      } catch (caught) {
        status = 'failed';
        failureReasonCode = 'scenario-error';
        error = String(caught?.message || caught).slice(0, 500);
      } finally {
        clearInterval(heapTimer);
      }
      if (state.alertCount > alertCountBefore && status === 'passed') {
        status = 'failed';
        failureReasonCode = 'browser-alert';
        error = 'The application displayed an alert during the scenario.';
      }
      const after = pageMetrics();
      return {
        id,
        status,
        failureReasonCode,
        durationMs: performance.now() - started,
        before,
        after,
        heapSamples,
        details: details || null,
        error,
        events: {
          alertCount: state.alertCount,
          errorCodes: [...state.errorCodes],
          contextLost: state.contextLost,
          contextRestored: state.contextRestored,
          outputs: state.outputs.map(publicOutput)
        }
      };
    },
    async teardown() {
      let stoppedRecording = false;
      try {
        if (recording && recStop) { recStop(); stoppedRecording = true; }
        if (screenRecording) { stopWholePageRecording(); stoppedRecording = true; }
      } catch { state.errorCodes.push('recording-cleanup-failed'); }
      if (stoppedRecording) await wait(500);
      if (dirtyTimer) clearTimeout(dirtyTimer);
      dirtyTimer = null;
      localStorage.removeItem(AUTOSAVE_KEY);
      canvasObserver.disconnect();
      for (const url of objectUrls.keys()) original.revokeObjectURL(url);
      objectUrls.clear();
      dl = original.dl;
      globalThis.alert = original.alert;
      HTMLAnchorElement.prototype.click = original.anchorClick;
      URL.createObjectURL = original.createObjectURL;
      URL.revokeObjectURL = original.revokeObjectURL;
      configureRenderer = original.configureRenderer;
      return { cleaned: state.errorCodes.length === 0, errorCodes: [...state.errorCodes] };
    }
  };
  return globalThis.__previsionStress.describe();
}

export const PAGE_BOOTSTRAP_SOURCE = `(${browserStressBootstrap.toString()})(${validateSyntheticStressProject.toString()},${createSyntheticStressOracle.toString()},${validateSyntheticActiveSceneIdentity.toString()})`;

async function waitForApplication(driver, signal) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (signal?.aborted) fail('Web stress run was interrupted');
    try {
      const ready = await driver.applicationReady();
      if (ready) return;
    } catch {
      // Page may still be navigating.
    }
    await sleep(150);
  }
  fail('PreVision Web did not become ready in the real browser');
}

function scenarioProcessMemory(samples, startEpochMs, endEpochMs, unavailableReason = 'No isolated process-memory sample was available for this interval.') {
  const within = samples.filter(sample => sample.atEpochMs >= startEpochMs && sample.atEpochMs <= endEpochMs && Number.isFinite(sample.memoryBytes));
  if (!within.length) {
    return {
      status: 'unsupported',
      metric: process.platform === 'win32' ? 'working-set-sum' : 'rss-sum',
      beforeBytes: null,
      afterBytes: null,
      peakBytes: null,
      deltaBytes: null,
      sampleCount: 0,
      unavailableReason
    };
  }
  return {
    status: 'measured',
    metric: process.platform === 'win32' ? 'working-set-sum' : 'rss-sum',
    beforeBytes: within[0].memoryBytes,
    afterBytes: within[within.length - 1].memoryBytes,
    peakBytes: Math.max(...within.map(sample => sample.memoryBytes)),
    deltaBytes: within[within.length - 1].memoryBytes - within[0].memoryBytes,
    sampleCount: within.length,
    processCountPeak: Math.max(...within.map(sample => sample.processCount || 0))
  };
}

function summarizeMemory(scenarios, samples) {
  const valid = samples.filter(sample => Number.isFinite(sample.memoryBytes));
  const heapValues = scenarios.flatMap(item => [
    item.page?.before?.jsHeap?.usedJSHeapSize,
    ...(item.page?.heapSamples || []).map(sample => sample.usedJSHeapSize),
    item.page?.after?.jsHeap?.usedJSHeapSize
  ]).filter(Number.isFinite);
  const longSession = scenarios.find(item => item.id === 'long-session');
  return {
    processMemoryMetric: process.platform === 'win32' ? 'working-set-sum' : 'rss-sum',
    processMemorySampledPeakBytes: valid.length ? Math.max(...valid.map(sample => sample.memoryBytes)) : null,
    processMemoryUnavailableReason: valid.length ? null : 'No isolated browser process-memory samples were available.',
    jsHeapSampledPeakBytes: heapValues.length ? Math.max(...heapValues) : null,
    jsHeapUnavailableReason: heapValues.length ? null : 'This browser does not expose performance.memory.',
    longSession: longSession ? {
      observationDurationMs: longSession.details?.observationDurationMs || null,
      processMemoryDeltaBytes: longSession.processMemory?.deltaBytes ?? null,
      usedJSHeapDeltaBytes: longSession.details?.usedJSHeapDelta ?? null,
      interpretation: 'Observed end-minus-start growth over this finite synthetic run; this is evidence, not by itself a leak diagnosis.'
    } : null
  };
}

function gitCommit(repositoryRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

async function fileSha256(absolutePath) {
  return crypto.createHash('sha256').update(await fsp.readFile(absolutePath)).digest('hex');
}

async function harnessIdentity(repositoryRoot, matrixPath) {
  const files = ['scripts/web-stress-lib.mjs', 'scripts/run-web-stress.mjs', matrixPath, DEFAULT_EVIDENCE_SCHEMA_PATH];
  const hashes = {};
  for (const relativePath of files) {
    hashes[relativePath] = await fileSha256(resolveInside(repositoryRoot, relativePath, 'harness identity file'));
  }
  return { schemaVersion: 1, files: hashes };
}

function environmentEvidence(browser, driver, machineAttestation) {
  const cpus = os.cpus();
  const ci = isCiEnvironment();
  const attested = machineAttestation !== 'unattested';
  const targetPair = isRequiredBrowserPair(browser);
  return {
    operatingSystem: `${os.type()} ${os.release()}`,
    platform: process.platform,
    architecture: process.arch,
    logicalCpuCount: cpus.length,
    totalMemoryGiBRounded: Math.max(1, Math.round(os.totalmem() / 1024 ** 3)),
    node: process.version,
    browser: { name: browser, version: driver.version, automation: driver.automation },
    ci,
    executionEnvironment: ci
      ? 'ci'
      : machineAttestation === 'physical-machine'
        ? 'local-physical-machine'
        : machineAttestation === 'approved-3d-gpu-vm'
          ? 'approved-3d-gpu-vm'
          : 'local-os-unattested',
    realMachineAttestation: machineAttestation,
    targetOsBrowserPair: targetPair,
    matrixEvidenceEligible: !ci && targetPair && attested,
    evidenceEligibilityBasis: ci || !targetPair
      ? 'ineligible-environment'
      : machineAttestation === 'physical-machine'
        ? 'operator-attested-physical-machine'
        : machineAttestation === 'approved-3d-gpu-vm'
          ? 'operator-attested-approved-3d-gpu-vm'
          : 'pending-operator-attestation',
    hostnameExcluded: true,
    usernameExcluded: true
  };
}

const SOFTWARE_GPU_PATTERN = /swiftshader|llvmpipe|software|microsoft basic render(?:er| driver)?|\bwarp\b/;

export function classifyChromiumGpuInfo(info = {}) {
  if (!info.gpu) {
    return {
      status: 'unsupported',
      source: 'cdp-system-info',
      reason: info.unavailableReason || 'GPU diagnostics unavailable'
    };
  }
  const devices = Array.isArray(info.gpu.devices) ? info.gpu.devices : [];
  const deviceLabels = devices.map(device => [device?.vendorString, device?.deviceString].filter(Boolean).join(' ').toLowerCase());
  const actualRenderer = [info.gpu.auxAttributes?.glVendor, info.gpu.auxAttributes?.glRenderer]
    .filter(Boolean).join(' ').toLowerCase();
  const softwareRenderingDetected = actualRenderer
    ? SOFTWARE_GPU_PATTERN.test(actualRenderer)
    : deviceLabels.length > 0 && deviceLabels.every(label => SOFTWARE_GPU_PATTERN.test(label));
  const labels = [...deviceLabels, actualRenderer].filter(Boolean).join(' ');
  return {
    status: 'measured',
    source: 'cdp-system-info',
    deviceCount: devices.length,
    category: softwareRenderingDetected ? 'software' : /apple/.test(labels) ? 'apple-silicon-or-apple-gpu' : 'hardware-unspecified',
    softwareRenderingDetected
  };
}

async function launchBrowserSession({ browser, origin, viewport, signal }) {
  const discovered = await discoverBrowser(browser);
  if (!discovered.available) fail(discovered.blocker || `${browser} is not available as a real browser on ${process.platform}`);
  if (browser === 'safari') return launchSafari({ executable: discovered.executable, origin, viewport, signal });
  return launchChromium({ browser, executable: discovered.executable, origin, viewport });
}

async function ensureSafeDirectory(repositoryRoot, relativeDirectory) {
  const root = path.resolve(repositoryRoot);
  const rootStat = await fsp.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('repositoryRoot must be a non-symlink directory');
  let cursor = root;
  for (const segment of validateRepositoryRelativePath(relativeDirectory, 'directory').split('/')) {
    cursor = path.join(cursor, segment);
    let stat = await fsp.lstat(cursor).catch(error => error?.code === 'ENOENT' ? null : Promise.reject(error));
    if (!stat) {
      await fsp.mkdir(cursor, { mode: 0o700 });
      stat = await fsp.lstat(cursor);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`Unsafe output directory: ${relativeDirectory}`);
  }
  return cursor;
}

async function prepareEvidenceDestination(repositoryRoot, relativePath) {
  const safe = validateRepositoryRelativePath(relativePath, 'outputPath');
  const parent = path.posix.dirname(safe);
  await ensureSafeDirectory(repositoryRoot, parent);
  const absolute = resolveInside(repositoryRoot, safe, 'outputPath');
  const existing = await fsp.lstat(absolute).catch(error => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (existing) fail(`Evidence output already exists and will not be overwritten: ${safe}`);
  return absolute;
}

export async function publishEvidenceAtomically(evidenceAbsolute, contents, { signal = null } = {}) {
  const partialAbsolute = `${evidenceAbsolute}.partial-${crypto.randomBytes(8).toString('hex')}`;
  let handle = null;
  let published = false;
  const assertNotAborted = () => {
    if (signal?.aborted) fail('Evidence publication was interrupted');
  };
  try {
    assertNotAborted();
    handle = await fsp.open(partialAbsolute, 'wx', 0o600);
    await handle.writeFile(contents);
    await handle.close();
    handle = null;
    assertNotAborted();
    await fsp.link(partialAbsolute, evidenceAbsolute);
    published = true;
    await fsp.unlink(partialAbsolute);
    if (signal?.aborted) {
      await fsp.unlink(evidenceAbsolute).catch(() => {});
      published = false;
      assertNotAborted();
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.unlink(partialAbsolute).catch(() => {});
    if (published) await fsp.unlink(evidenceAbsolute).catch(() => {});
    throw error;
  }
}

async function createOwnedBuildPath(repositoryRoot) {
  await ensureSafeDirectory(repositoryRoot, 'dist');
  const nonce = crypto.randomBytes(12).toString('hex');
  const outputRelative = `${DEFAULT_BUILD_PATH}-${nonce}`;
  const markerRelative = `dist/.prevision-web-stress-${nonce}.owner`;
  const outputAbsolute = resolveInside(repositoryRoot, outputRelative, 'build output');
  const markerAbsolute = resolveInside(repositoryRoot, markerRelative, 'build marker');
  if (await fsp.lstat(outputAbsolute).catch(() => null)) fail('Unique Web stress build path unexpectedly exists');
  const marker = await fsp.open(markerAbsolute, 'wx', 0o600);
  try {
    await marker.writeFile(`${JSON.stringify({ schemaVersion: 1, nonce })}\n`);
  } finally {
    await marker.close();
  }
  return { nonce, outputRelative, outputAbsolute, markerRelative, markerAbsolute };
}

async function removeOwnedBuildPath(build) {
  if (!build) return;
  const marker = JSON.parse(await fsp.readFile(build.markerAbsolute, 'utf8'));
  if (marker.schemaVersion !== 1 || marker.nonce !== build.nonce) fail('Web stress build ownership marker does not match');
  const outputStat = await fsp.lstat(build.outputAbsolute).catch(error => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (outputStat) {
    if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) fail('Owned Web stress build path became unsafe');
    await fsp.rm(build.outputAbsolute, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  }
  await fsp.unlink(build.markerAbsolute);
}

function browserEventSummary(events) {
  return {
    consoleCollection: events.consoleCollectionUnavailableReason ? 'unsupported' : 'measured',
    consoleErrorCount: events.consoleErrors?.length || 0,
    exceptionCount: events.exceptions?.length || 0,
    crashStatus: events.crashDetectionUnavailableReason ? 'unsupported' : events.crashed ? 'observed' : 'not-observed',
    detachedStatus: events.detached ? 'observed' : 'not-observed',
    limitation: events.consoleCollectionUnavailableReason || null,
    crashDetectionLimitation: events.crashDetectionUnavailableReason || null
  };
}

export async function runWebStress({
  browser,
  profileName = 'standard',
  machineAttestation = 'unattested',
  outputPath,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  matrixPath = DEFAULT_MATRIX_PATH,
  onProgress = () => {},
  signal = null
} = {}) {
  if (!SUPPORTED_BROWSERS.includes(browser)) fail(`Unsupported browser: ${browser}`);
  if (!SUPPORTED_PROFILES.includes(profileName)) fail(`Unsupported profile: ${profileName}`);
  if (!SUPPORTED_ATTESTATIONS.includes(machineAttestation)) fail(`Unsupported machine attestation: ${machineAttestation}`);
  if (machineAttestation === 'approved-3d-gpu-vm' && process.platform !== 'win32') {
    fail('approved-3d-gpu-vm attestation is only valid for the Windows matrix');
  }
  if (isCiEnvironment()) fail('Real-browser stress evidence cannot run in CI; CI is structural coverage only.');
  if (!isRequiredBrowserPair(browser)) fail(`${browser} on ${process.platform} is outside the required real-browser matrix.`);
  if (signal?.aborted) fail('Web stress run was aborted before it started');
  const matrix = await readStressMatrix({ repositoryRoot, matrixPath });
  const evidenceSchema = await readEvidenceSchema(repositoryRoot);
  const harness = await harnessIdentity(repositoryRoot, matrixPath);
  const profile = matrix.profiles[profileName];
  const config = {
    profile,
    panorama: matrix.panorama,
    typicalScene: matrix.typicalScene,
    viewport: matrix.viewport
  };
  const evidencePath = outputPath || `${DEFAULT_EVIDENCE_DIRECTORY}/${browser}-${profileName}.json`;
  if (!evidencePath.startsWith(`${DEFAULT_EVIDENCE_DIRECTORY}/`) || !evidencePath.endsWith('.json')) {
    fail(`outputPath must be a .json child of ${DEFAULT_EVIDENCE_DIRECTORY}/`);
  }
  const evidenceAbsolute = await prepareEvidenceDestination(repositoryRoot, evidencePath);
  let preview;
  let driver;
  let sampler;
  let ownedBuild;
  let buildResult;
  let rawResult;
  let runError;
  const privateRoots = [];
  const startedAt = new Date();
  const scenarios = [];
  let cleanupPromise;
  const cleanup = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const errors = [];
      let pageTeardown = null;
      if (driver) {
        try {
          pageTeardown = await withTimeout(
            driver.teardownStressBridge(),
            8000,
            'page stress teardown'
          );
          if (pageTeardown?.cleaned === false) errors.push('page-runtime-cleanup-reported-error');
        } catch {
          errors.push('page-teardown-failed');
        }
      }
      if (sampler) {
        try { await sampler.stop(); } catch { errors.push('process-sampler-stop-failed'); }
      }
      if (driver) {
        try {
          await driver.close();
        } catch (error) {
          const knownBrowserCleanupCodes = [
            'owned-browser-process-not-terminated',
            'owned-crash-helper-not-terminated',
            'owned-browser-profile-not-removed'
          ];
          const matched = knownBrowserCleanupCodes.filter(code => String(error?.message || '').includes(code));
          errors.push(...(matched.length ? matched : ['browser-cleanup-failed']));
        }
      }
      if (preview) {
        try { await preview.close(); } catch { errors.push('preview-cleanup-failed'); }
      }
      if (ownedBuild) {
        try { await removeOwnedBuildPath(ownedBuild); } catch { errors.push('build-cleanup-failed'); }
      }
      return { status: errors.length ? 'failed' : 'passed', errors, pageTeardown };
    })();
    return cleanupPromise;
  };
  const throwIfAborted = () => {
    if (signal?.aborted) fail('Web stress run was interrupted');
  };
  // Once a driver exists, closing it interrupts an in-flight long scenario. Before that
  // point, let the current bounded build/launch await settle so cleanup cannot race a
  // resource that has not yet been assigned to this scope.
  const onAbort = () => {
    if (driver) void cleanup();
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    onProgress({ phase: 'build', message: 'Building the deterministic static Web runtime' });
    ownedBuild = await createOwnedBuildPath(repositoryRoot);
    buildResult = await buildWeb({ repositoryRoot, outputDirectory: ownedBuild.outputRelative });
    throwIfAborted();
    preview = await startPreviewServer({ rootDirectory: buildResult.outputDirectory, port: 0 });
    throwIfAborted();
    const origin = `${preview.origin}/director/`;
    onProgress({ phase: 'launch', message: `Launching real ${browser}` });
    driver = await launchBrowserSession({ browser, origin, viewport: matrix.viewport, signal });
    throwIfAborted();
    privateRoots.push(...driver.privateRoots);
    sampler = driver.supportsIsolatedRss
      ? startProcessSampler(driver.pid, profile.memorySampleMs)
      : { samples: [], effectiveIntervalMs: null, methodOverhead: 'unsupported', async stop() {} };
    await waitForApplication(driver, signal);
    throwIfAborted();
    const bootstrap = await driver.installStressBridge();
    throwIfAborted();
    const browserSystem = await driver.systemInfo();
    const runEnvironment = environmentEvidence(browser, driver, machineAttestation);
    if (browserSystem.softwareRenderingDetected === true) {
      runEnvironment.matrixEvidenceEligible = false;
      runEnvironment.evidenceEligibilityBasis = 'software-rendering-detected';
    } else if (browser !== 'safari'
      && (browserSystem.status !== 'measured' || !(browserSystem.deviceCount > 0))) {
      runEnvironment.matrixEvidenceEligible = false;
      runEnvironment.evidenceEligibilityBasis = 'gpu-diagnostics-unavailable';
    }
    for (const id of matrix.scenarioOrder) {
      if (signal?.aborted) fail('Web stress run was interrupted');
      onProgress({ phase: 'scenario', id, message: `Running ${id}` });
      const startEpochMs = Date.now();
      let page;
      try {
        page = await driver.runScenario(id, config);
      } catch (error) {
        page = { id, status: 'failed', error: sanitizeText(error.message, privateRoots), before: null, after: null, details: null, events: null };
      }
      const endEpochMs = Date.now();
      scenarios.push({
        id,
        status: page?.status || 'failed',
        failureReasonCode: page?.failureReasonCode || null,
        startedAt: new Date(startEpochMs).toISOString(),
        endedAt: new Date(endEpochMs).toISOString(),
        wallDurationMs: endEpochMs - startEpochMs,
        page: {
          durationMs: page?.durationMs ?? null,
          before: page?.before || null,
          after: page?.after || null,
          heapSamples: page?.heapSamples || []
        },
        details: page?.details || null,
        error: page?.error || null,
        events: page?.events || null,
        processMemory: scenarioProcessMemory(
          sampler.samples,
          startEpochMs,
          endEpochMs,
          browser === 'safari'
            ? 'Safari WebDriver does not expose a reliably attributable Safari/WebContent/GPU process set.'
            : 'No isolated process-memory sample was available for this interval.'
        )
      });
      if (driver.child.exitCode !== null || driver.events.crashed) break;
    }
    for (const id of matrix.scenarioOrder.slice(scenarios.length)) {
      scenarios.push({
        id,
        status: 'not-run',
        failureReasonCode: 'browser-terminated-before-scenario',
        startedAt: null,
        endedAt: null,
        wallDurationMs: null,
        page: { durationMs: null, before: null, after: null, heapSamples: [] },
        details: null,
        events: null,
        processMemory: { status: 'unsupported' }
      });
    }
    throwIfAborted();
    await sampler.stop();
    throwIfAborted();
    const completedAt = new Date();
    const contextLost = Math.max(0, ...scenarios.map(item => item.events?.contextLost || 0));
    const failures = scenarios.filter(item => item.status !== 'passed').map(item => item.id);
    rawResult = {
      schemaVersion: 1,
      taskId: matrix.taskId,
      sourceCommit: gitCommit(repositoryRoot),
      harness,
      profile: profileName,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt - startedAt,
      environment: runEnvironment,
      runtime: {
        staticBuildHomeMode: buildResult.homeMode,
        deploymentManifestSha256: crypto.createHash('sha256').update(JSON.stringify(buildResult.manifest)).digest('hex'),
        directorSha256: buildResult.manifest.files.find(file => file.path === 'director/index.html')?.sha256 || null,
        route: '/director/',
        previewBinding: '127.0.0.1',
        applicationNetworkScope: 'loopback-only',
        renderSchedulingControl: browser === 'safari'
          ? 'native-safari-scheduling-visibility-observed'
          : 'headful-background-throttling-disabled-visibility-still-observed',
        browserExternalNetworkControl: browser === 'safari'
          ? 'not-measured-by-webdriver'
          : 'closed-loopback-browser-and-process-proxy-plus-host-resolver-deny',
        projectDataUploadPathPresent: false,
        browserIsolation: browser === 'safari' ? 'safari-webdriver-isolated-session' : 'temporary-user-data-directory',
        generatedArtifactHandling: 'in-memory-metadata-only'
      },
      parameters: config,
      bootstrap,
      browserSystem,
      scenarios,
      memory: summarizeMemory(scenarios, sampler.samples),
      processMemorySampling: {
        requestedIntervalMs: profile.memorySampleMs,
        effectiveIntervalMs: sampler.effectiveIntervalMs,
        methodOverhead: sampler.methodOverhead
      },
      processSamples: sampler.samples,
      browserEvents: browserEventSummary(driver.events),
      verdict: {
        completed: failures.length === 0 && !driver.events.crashed && driver.child.exitCode === null && contextLost === 0,
        matrixEvidenceEligible: runEnvironment.matrixEvidenceEligible,
        evidenceEligibilityBasis: runEnvironment.evidenceEligibilityBasis,
        failedScenarios: failures,
        crash: driver.events.crashDetectionUnavailableReason
          ? {
              status: 'unsupported',
              detection: 'webdriver-command-channel-only',
              reason: driver.events.crashDetectionUnavailableReason
            }
          : {
              status: driver.events.crashed || driver.child.exitCode !== null ? 'observed' : 'not-observed',
              detection: 'cdp-target-and-owned-process'
            },
        webglContextLost: {
          status: contextLost ? 'observed' : 'not-observed',
          count: contextLost,
          observationDurationMs: completedAt - startedAt
        },
        optimizationDecision: 'No product limit or optimization is inferred automatically; compare this evidence across the required real browsers first.'
      },
      evidencePolicy: matrix.evidence
    };
  } catch (error) {
    runError = error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  const cleanupResult = await cleanup();
  if (runError) {
    const cleanupSuffix = cleanupResult.errors.length ? `; cleanup failures: ${cleanupResult.errors.join(', ')}` : '';
    throw new Error(`${sanitizeText(runError.message, privateRoots)}${cleanupSuffix}`);
  }
  throwIfAborted();
  rawResult.cleanup = cleanupResult;
  rawResult.completedAt = new Date().toISOString();
  rawResult.durationMs = new Date(rawResult.completedAt) - startedAt;
  if (cleanupResult.status !== 'passed') rawResult.verdict.completed = false;
  const sanitized = validatePublicEvidence(buildPublicEvidence(rawResult, privateRoots), evidenceSchema);
  await publishEvidenceAtomically(evidenceAbsolute, `${JSON.stringify(sanitized, null, 2)}\n`, { signal });
  return { result: sanitized, evidencePath };
}
