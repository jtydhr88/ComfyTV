/*
 * PreVision Web static build and loopback preview contract tests.
 * Uses only temporary fixtures and never writes repository build output.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildWeb,
  createRequestHandler,
  loadDeployment,
  readRuntimeContract,
  startPreviewServer
} from '../scripts/web-runtime-lib.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractRelativePath = 'web/runtime-contract.json';
const contract = JSON.parse(await fsp.readFile(path.join(repositoryRoot, contractRelativePath), 'utf8'));
let passed = 0;
let failed = 0;

async function test(name, body) {
  try {
    await body();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.stack || error.message}`);
  }
}

async function withTempDirectory(body) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'prevision-web-test-'));
  try {
    return await body(directory);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
}

async function copyFileWithParents(source, target) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.copyFile(source, target);
}

async function createFixture(directory) {
  await copyFileWithParents(
    path.join(repositoryRoot, contractRelativePath),
    path.join(directory, contractRelativePath)
  );
  const sourceFiles = [contract.director.source, ...contract.requiredFiles.map(item => item.source)];
  for (const relativePath of sourceFiles) {
    await copyFileWithParents(path.join(repositoryRoot, relativePath), path.join(directory, relativePath));
  }
  return directory;
}

async function collectFiles(root) {
  const files = [];
  async function visit(directory, prefix) {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath, relativePath);
      else files.push({ path: relativePath, bytes: await fsp.readFile(absolutePath) });
    }
  }
  await visit(root, '');
  return files;
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function request(origin, { requestPath = '/', method = 'GET', headers = {}, hostHeader } = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const requestHeaders = { ...headers };
    if (hostHeader !== undefined) requestHeaders.Host = hostHeader;
    const outgoing = http.request({
      hostname: url.hostname,
      port: url.port,
      path: requestPath,
      method,
      headers: requestHeaders
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    outgoing.once('error', reject);
    outgoing.end();
  });
}

function assertSecurityHeaders(response) {
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin');
  assert.match(response.headers['permissions-policy'], /display-capture=\(self\)/);
  const csp = response.headers['content-security-policy'];
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /media-src 'self' data: blob:/);
  assert.match(csp, /connect-src 'self' data: blob:/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(response.headers['permissions-policy'], /camera=\(\)/);
  assert.match(response.headers['permissions-policy'], /microphone=\(\)/);
  assert.match(response.headers['permissions-policy'], /geolocation=\(\)/);
  assert.doesNotMatch(csp, /unsafe-eval|https?:|\*/);
}

console.log('· Web runtime contract and deterministic build');

await test('contract declares the static runtime, home slot, and two public routes', async () => {
  const loaded = await readRuntimeContract({ repositoryRoot });
  assert.equal(loaded.contract.mode, 'static-web-runtime');
  assert.equal(loaded.contract.home.sourceDirectory, 'web/home');
  assert.equal(loaded.contract.home.optional, true);
  assert.deepEqual(loaded.contract.routes.map(route => route.path), ['/', '/director/']);
  assert.deepEqual(loaded.contract.director.rootAssetPrefixes, ['assets/', 'i18n/', 'vendor/']);
});

await test('production home keeps interaction, media, accessibility, and completion contracts deterministic', async () => {
  const homeRoot = path.join(repositoryRoot, 'web/home');
  const html = await fsp.readFile(path.join(homeRoot, 'index.html'), 'utf8');
  const css = await fsp.readFile(path.join(homeRoot, 'home.css'), 'utf8');
  const script = await fsp.readFile(path.join(homeRoot, 'home.js'), 'utf8');
  const entries = await fsp.readdir(path.join(homeRoot, 'home-assets'));
  assert.deepEqual(entries.sort(), ['1.svg', '2.svg', '3.svg', '4.svg', '5.svg', '6.svg', 'intro-poster.jpg', 'intro.mp4']);
  const versionSvg = await fsp.readFile(path.join(homeRoot, 'home-assets', '6.svg'), 'utf8');
  const zhCn = await fsp.readFile(path.join(repositoryRoot, 'i18n/locales/zh-CN.js'), 'utf8');
  const enUs = await fsp.readFile(path.join(repositoryRoot, 'i18n/locales/en-US.js'), 'utf8');
  assert.match(versionSvg, /data-visible-version="v0\.8\.0"/);
  assert.match(versionSvg, /<title>PreVision v0\.8\.0<\/title>/);
  assert.doesNotMatch(versionSvg, /v0\.7\.2/);
  assert.match(versionSvg, /translate\(103\.325067, 40\.466703\)[\s\S]*?M 10\.078125 0\.328125/);
  assert.doesNotMatch(versionSvg, /M 2\.421875 0 L 2\.421875 -2\.0625/);
  assert.match(zhCn, /'landing\.versionAlt': 'PreVision 版本 0\.8\.0'/);
  assert.match(enUs, /'landing\.versionAlt': 'PreVision version 0\.8\.0'/);
  assert.match(html, /<video[^>]+playsinline[^>]+poster="home-assets\/intro-poster\.jpg"/);
  assert.doesNotMatch(html, /<video[^>]+muted/);
  assert.match(html, /<source src="home-assets\/intro\.mp4\?v=20260715-2" type="video\/mp4">/);
  assert.equal((html.match(/<(?:a|button)\b/g) || []).length, 2);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /data-i18n-aria-label="landing\.actionAria"/);
  assert.match(html, /<img class="piece piece--brand"[^>]+src="home-assets\/3\.svg"/);
  assert.doesNotMatch(html, /brand-layer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const narrowLayout = css.match(/@media \(max-aspect-ratio: 4\/3\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(narrowLayout, /\.piece--tagline,[\s\S]*\.piece--brand,[\s\S]*\.piece--features,[\s\S]*\.piece--version[\s\S]*background-color: #f6e8c8/);
  assert.match(narrowLayout, /\.piece--social:focus-visible,[\s\S]*\.piece--action:focus-visible[\s\S]*outline-color: #180e09[\s\S]*box-shadow: 0 0 0 5px #f6e8c8/);
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (max-aspect-ratio: 4/3)')), /background-color: #f6e8c8/);
  assert.match(css, /data-state="starting"[\s\S]*data-state="playing"[\s\S]*brightness\(\.975\)/);
  assert.match(css, /transition: filter 180ms ease/);
  assert.match(css, /--dissolve-delay/);
  assert.match(script, /seeded\(0x505256\)/);
  assert.match(script, /particleBudget: 520/);
  assert.match(script, /largeBudget: 56/);
  assert.match(script, /mediumBudget: 160/);
  assert.doesNotMatch(script, /AudioContext|playActionSound/);
  assert.match(script, /await video\.play\(\)/);
  assert.match(script, /error\?\.name !== 'NotAllowedError'/);
  assert.match(script, /video\.muted = true;[\s\S]*await video\.play\(\);[\s\S]*video\.muted = false/);
  assert.match(script, /if \(video\.paused\) await video\.play\(\)/);
  assert.match(script, /maxDevicePixelRatio: 2/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /prevision:intro-complete/);
  assert.match(script, /const directorPath = '\/director\/'/);
  assert.match(script, /target: directorPath/);
  assert.match(script, /video\.addEventListener\('error'/);
  assert.equal((script.match(/location\.assign\(directorPath\)/g) || []).length, 1);
  assert.match(script, /if \(navigationQueued \|\| state !== 'complete'\) return false/);
  assert.match(script, /navigationQueued = true;[\s\S]*queueMicrotask\([\s\S]*state === 'complete'[\s\S]*runId === completedRun[\s\S]*location\.assign\(directorPath\)/);
  assert.ok(
    script.indexOf("dispatchEvent(new CustomEvent('prevision:intro-complete'") < script.indexOf('requestDirectorNavigation();'),
    'the completion event must finish before navigation is requested'
  );
  assert.match(script, /navigationQueued = false;[\s\S]*piece\.hidden = false/);
  assert.match(script, /const stallTimeoutMs = 8000/);
  assert.match(script, /video\.addEventListener\('stalled'[\s\S]*armStallWatchdog\(\)/);
  assert.match(script, /video\.addEventListener\('waiting'[\s\S]*armStallWatchdog\(\)/);
  assert.match(script, /video\.addEventListener\('playing'[\s\S]*clearStallWatchdog\(\)/);
  assert.match(script, /video\.addEventListener\('timeupdate', clearStallWatchdog\)/);

  const navigationCalls = [];
  const completionEvents = [];
  const microtasks = [];
  const listeners = new Map();
  const timeoutCallbacks = new Map();
  let nextTimer = 1;
  const root = { dataset: {}, classList: { add() {}, remove() {} } };
  const piece = {
    hidden: false,
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 100, height: 40 }),
    getAnimations: () => []
  };
  const video = {
    currentTime: 0,
    paused: true,
    addEventListener(type, listener) { listeners.set(`video:${type}`, listener); },
    pause() {},
    play() { this.paused = false; return Promise.resolve(); }
  };
  const action = { disabled: false, addEventListener(type, listener) { listeners.set(`action:${type}`, listener); } };
  const status = { textContent: '' };
  const context = { setTransform() {}, clearRect() {}, fillRect() {}, globalAlpha: 1, fillStyle: '' };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const document = {
    hidden: false,
    querySelector: () => root,
    querySelectorAll: () => [piece],
    getElementById(id) { return { introVideo: video, actionButton: action, introStatus: status, particleCanvas: canvas }[id]; },
    addEventListener(type, listener) { listeners.set(`document:${type}`, listener); }
  };
  const sandbox = {
    document,
    window: null,
    location: { assign(target) { navigationCalls.push(target); } },
    matchMedia: () => ({ matches: false }),
    addEventListener(type, listener) { listeners.set(`window:${type}`, listener); },
    dispatchEvent(event) { completionEvents.push(event); return true; },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    PreVisionI18n: { t: key => key, apply() {} },
    queueMicrotask(callback) { microtasks.push(callback); },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout(callback) { const id = nextTimer++; timeoutCallbacks.set(id, callback); return id; },
    clearTimeout(id) { timeoutCallbacks.delete(id); },
    performance: { now: () => 0 },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
    Math,
    Set,
    Object,
    Array,
    Promise
  };
  sandbox.window = sandbox;
  vm.runInNewContext(script, sandbox, { filename: 'web/home/home.js' });
  sandbox.PreVisionIntro.completeForTest();
  sandbox.PreVisionIntro.completeForTest();
  assert.equal(completionEvents.length, 1, 'completion is emitted once');
  assert.equal(navigationCalls.length, 0, 'navigation waits until completion listeners return');
  assert.equal(microtasks.length, 1, 'only one navigation is queued');
  microtasks.shift()();
  assert.deepEqual(navigationCalls, ['/director/']);
  assert.equal(completionEvents[0].detail.target, '/director/');

  sandbox.PreVisionIntro.reset();
  await sandbox.PreVisionIntro.start();
  listeners.get('video:stalled')();
  const transientWatchdog = [...timeoutCallbacks.entries()].at(-1);
  assert.ok(transientWatchdog, 'a transient stall arms the watchdog');
  listeners.get('video:playing')();
  transientWatchdog[1]();
  assert.equal(sandbox.PreVisionIntro.getState(), 'playing', 'resumed playback invalidates the old watchdog');

  sandbox.PreVisionIntro.reset();
  await sandbox.PreVisionIntro.start();
  listeners.get('video:stalled')();
  const permanentWatchdog = [...timeoutCallbacks.entries()].at(-1);
  permanentWatchdog[1]();
  assert.equal(sandbox.PreVisionIntro.getState(), 'idle', 'a permanent stall restores a retryable intro');
  assert.equal(action.disabled, false);

  sandbox.PreVisionIntro.reset();
  await sandbox.PreVisionIntro.start();
  listeners.get('video:stalled')();
  const staleWatchdog = [...timeoutCallbacks.entries()].at(-1);
  sandbox.PreVisionIntro.completeForTest();
  staleWatchdog[1]();
  assert.equal(sandbox.PreVisionIntro.getState(), 'complete', 'completion invalidates an older stall watchdog');
});

await test('fallback build is byte-deterministic and contains only the declared runtime', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const first = await buildWeb({ repositoryRoot: fixture, outputDirectory: 'dist/first' });
    const second = await buildWeb({ repositoryRoot: fixture, outputDirectory: 'dist/second' });
    assert.equal(first.homeMode, 'director-fallback');
    assert.equal(second.homeMode, 'director-fallback');
    const firstFiles = await collectFiles(first.outputDirectory);
    const secondFiles = await collectFiles(second.outputDirectory);
    assert.deepEqual(firstFiles.map(file => file.path), secondFiles.map(file => file.path));
    for (let index = 0; index < firstFiles.length; index += 1) {
      assert.deepEqual(firstFiles[index].bytes, secondFiles[index].bytes, firstFiles[index].path);
    }
    const manifestBytes = await fsp.readFile(path.join(first.outputDirectory, contract.manifest));
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.homeMode, 'director-fallback');
    assert.deepEqual(manifest.files, [...manifest.files].sort((a, b) => a.path.localeCompare(b.path, 'en')));
    assert.doesNotMatch(manifestBytes.toString('utf8'), /created|timestamp|\/Users\/|[A-Za-z]:\\Users\\/i);
    assert.deepEqual(
      await fsp.readFile(path.join(first.outputDirectory, 'index.html')),
      await fsp.readFile(path.join(first.outputDirectory, contract.director.entry))
    );
    const director = await fsp.readFile(path.join(first.outputDirectory, contract.director.entry), 'utf8');
    assert.doesNotMatch(director, /<base\b/i);
    assert.match(director, /src="\/vendor\/html2canvas\.min\.js"/);
    assert.match(director, /src="\/assets\/PreVisionIcon-128\.png"/);
    assert.match(director, /src="\/i18n\/runtime\.js"/);
    assert.match(director, /<use href="#i-plus"\/>/);

    const expectedPaths = new Set([
      contract.home.entry,
      contract.director.entry,
      contract.deployedContract,
      contract.manifest,
      ...contract.requiredFiles.map(item => item.output)
    ]);
    assert.deepEqual(new Set(firstFiles.map(file => file.path)), expectedPaths);
    for (const mapping of contract.requiredFiles) {
      const source = await fsp.readFile(path.join(fixture, mapping.source));
      const output = await fsp.readFile(path.join(first.outputDirectory, mapping.output));
      assert.equal(hash(output), hash(source), mapping.output);
      const item = manifest.files.find(file => file.path === mapping.output);
      assert.equal(item.sha256, hash(source), mapping.output);
      assert.equal(item.size, source.length, mapping.output);
    }
  });
});

await test('a final home can be inserted without changing build logic', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    await fsp.mkdir(path.join(fixture, 'web/home/home-assets'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), '<!doctype html><title>Home</title><script src="home-assets/site.js"></script>\n');
    await fsp.writeFile(path.join(fixture, 'web/home/home-assets/site.js'), 'globalThis.homeReady = true;\n');
    const result = await buildWeb({ repositoryRoot: fixture });
    assert.equal(result.homeMode, 'provided-home');
    assert.equal(await fsp.readFile(path.join(result.outputDirectory, 'index.html'), 'utf8'), '<!doctype html><title>Home</title><script src="home-assets/site.js"></script>\n');
    assert.equal(await fsp.readFile(path.join(result.outputDirectory, 'home-assets/site.js'), 'utf8'), 'globalThis.homeReady = true;\n');
    assert.match(await fsp.readFile(path.join(result.outputDirectory, contract.director.entry), 'utf8'), /src="\/i18n\/runtime\.js"/);
  });
});

await test('rebuild removes stale output but failed source validation preserves prior output', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const first = await buildWeb({ repositoryRoot: fixture });
    const stale = path.join(first.outputDirectory, 'stale.txt');
    await fsp.writeFile(stale, 'stale');
    await buildWeb({ repositoryRoot: fixture });
    await assert.rejects(fsp.access(stale));
    const marker = path.join(first.outputDirectory, 'preserved.marker');
    await fsp.writeFile(marker, 'keep-on-failure');
    const missing = contract.requiredFiles[0].source;
    await fsp.rm(path.join(fixture, missing));
    await assert.rejects(
      buildWeb({ repositoryRoot: fixture }),
      error => error.message.includes(missing)
    );
    assert.equal(await fsp.readFile(marker, 'utf8'), 'keep-on-failure');
  });
});

await test('build rejects traversal, reserved home collisions, and source symlinks', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    await assert.rejects(buildWeb({ repositoryRoot: fixture, outputDirectory: '../escaped' }), /relative|parent|dot/);
    const sourceContractBefore = await fsp.readFile(path.join(fixture, contractRelativePath));
    await assert.rejects(buildWeb({ repositoryRoot: fixture, outputDirectory: 'web' }), /child of dist/);
    assert.deepEqual(await fsp.readFile(path.join(fixture, contractRelativePath)), sourceContractBefore);
    const renamedManifestContract = JSON.parse(sourceContractBefore.toString('utf8'));
    renamedManifestContract.manifest = 'renamed-manifest.json';
    await fsp.writeFile(path.join(fixture, contractRelativePath), `${JSON.stringify(renamedManifestContract, null, 2)}\n`);
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /manifest must be prevision-web-manifest\.json/);
    await fsp.writeFile(path.join(fixture, contractRelativePath), sourceContractBefore);

    const outside = path.join(fixture, 'outside-output');
    await fsp.mkdir(outside);
    await fsp.symlink(outside, path.join(fixture, 'dist'));
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /outputDirectory.*symbolic link/);
    assert.deepEqual(await fsp.readdir(outside), []);
    await fsp.rm(path.join(fixture, 'dist'));

    await fsp.mkdir(path.join(fixture, 'web/home/vendor'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), 'home');
    await fsp.writeFile(path.join(fixture, 'web/home/vendor/collision.js'), 'collision');
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /reserved path/);
    await fsp.rm(path.join(fixture, 'web/home'), { recursive: true, force: true });

    await fsp.mkdir(path.join(fixture, 'web/home'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), 'home');
    await fsp.mkdir(path.join(fixture, 'web/home/Director'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/Director/index.html'), 'must-not-overwrite');
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /reserved path/);
    await fsp.rm(path.join(fixture, 'web/home'), { recursive: true, force: true });

    await fsp.mkdir(path.join(fixture, 'web/home'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), '<script src="missing.js"></script>');
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /missing dependency/);
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), '<script src="//example.test/remote.js"></script>');
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /remote dependency/);
    await fsp.rm(path.join(fixture, 'web/home'), { recursive: true, force: true });

    const directorPath = path.join(fixture, contract.director.source);
    const originalDirector = await fsp.readFile(directorPath, 'utf8');
    await fsp.writeFile(directorPath, originalDirector.replace('</head>', '<script src="//example.test/remote.js"></script></head>'));
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /remote asset reference/);
    await fsp.writeFile(directorPath, originalDirector.replace('</head>', '<script src="/missing.js"></script></head>'));
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /undeclared asset/);
    await fsp.writeFile(directorPath, originalDirector);

    await fsp.mkdir(path.join(fixture, 'web/home'), { recursive: true });
    await fsp.writeFile(path.join(fixture, 'web/home/index.html'), 'home');
    await fsp.writeFile(path.join(fixture, 'web/home/.env'), 'forbidden');
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /unsafe URL path/);
    await fsp.rm(path.join(fixture, 'web/home'), { recursive: true, force: true });

    const target = path.join(fixture, contract.requiredFiles[0].source);
    const internalTarget = path.join(fixture, contract.requiredFiles[1].source);
    await fsp.rm(target);
    await fsp.symlink(internalTarget, target);
    await assert.rejects(buildWeb({ repositoryRoot: fixture }), /symbolic links/);
  });
});

console.log('· Loopback production preview');

await test('preview serves routes, MIME types, director dependencies, and safe fallbacks', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const built = await buildWeb({ repositoryRoot: fixture });
    const preview = await startPreviewServer({ rootDirectory: built.outputDirectory, port: 0 });
    try {
      assert.equal(preview.host, '127.0.0.1');
      assert.equal(preview.server.address().address, '127.0.0.1');
      const home = await request(preview.origin);
      assert.equal(home.status, 200);
      assert.match(home.headers['content-type'], /^text\/html; charset=utf-8$/);
      assertSecurityHeaders(home);

      const redirect = await request(preview.origin, { requestPath: '/director' });
      assert.equal(redirect.status, 308);
      assert.equal(redirect.headers.location, '/director/');
      assertSecurityHeaders(redirect);
      const redirectWithQuery = await request(preview.origin, { requestPath: '/director?token=preview%20only' });
      assert.equal(redirectWithQuery.status, 308);
      assert.equal(redirectWithQuery.headers.location, '/director/?token=preview%20only');

      const director = await request(preview.origin, { requestPath: '/director/' });
      assert.equal(director.status, 200);
      const html = director.body.toString('utf8');
      const knownDependencies = [...html.matchAll(/(?:src|href)="(\/(?:vendor\/html2canvas\.min\.js|assets\/PreVisionIcon-128\.png|i18n\/(?:locales\/(?:zh-CN|en-US)\.js|runtime\.js)))"/g)]
        .map(match => new URL(match[1], `${preview.origin}/director/`).pathname);
      assert.deepEqual(new Set(knownDependencies), new Set([
        '/vendor/html2canvas.min.js',
        '/assets/PreVisionIcon-128.png',
        '/i18n/locales/zh-CN.js',
        '/i18n/locales/en-US.js',
        '/i18n/runtime.js'
      ]));
      for (const dependency of knownDependencies) {
        const response = await request(preview.origin, { requestPath: dependency });
        assert.equal(response.status, 200, dependency);
        assert.notEqual(response.headers['content-type'], 'application/octet-stream', dependency);
      }

      const javascript = await request(preview.origin, { requestPath: '/i18n/runtime.js?version=1' });
      assert.equal(javascript.status, 200);
      assert.equal(javascript.headers['content-type'], 'text/javascript; charset=utf-8');
      const json = await request(preview.origin, { requestPath: `/${contract.deployedContract}` });
      assert.equal(json.status, 200);
      assert.equal(json.headers['content-type'], 'application/json; charset=utf-8');
      const manifest = await request(preview.origin, { requestPath: `/${contract.manifest}` });
      assert.equal(manifest.status, 200);
      assert.equal(manifest.headers['content-type'], 'application/json; charset=utf-8');
      const png = await request(preview.origin, { requestPath: '/assets/PreVisionIcon-128.png' });
      assert.equal(png.status, 200);
      assert.equal(png.headers['content-type'], 'image/png');

      const directorFallback = await request(preview.origin, {
        requestPath: '/director/project/example',
        headers: { Accept: 'text/html' }
      });
      assert.equal(directorFallback.status, 200);
      assert.deepEqual(directorFallback.body, director.body);
      const unknownHomeRoute = await request(preview.origin, {
        requestPath: '/share/example',
        headers: { Accept: 'text/html' }
      });
      assert.equal(unknownHomeRoute.status, 404);
      const missingAsset = await request(preview.origin, {
        requestPath: '/director/missing.js',
        headers: { Accept: 'text/html' }
      });
      assert.equal(missingAsset.status, 404);
      assertSecurityHeaders(missingAsset);
    } finally {
      await preview.close();
      assert.equal(preview.server.listening, false);
    }
  });
});

await test('preview enforces method, HEAD, Host, and raw traversal boundaries', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const built = await buildWeb({ repositoryRoot: fixture });
    const preview = await startPreviewServer({ rootDirectory: built.outputDirectory, port: 0 });
    try {
      const head = await request(preview.origin, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.body.length, 0);
      assert.ok(Number(head.headers['content-length']) > 0);
      assertSecurityHeaders(head);

      const post = await request(preview.origin, { method: 'POST' });
      assert.equal(post.status, 405);
      assert.equal(post.headers.allow, 'GET, HEAD');
      assertSecurityHeaders(post);

      const evilHost = await request(preview.origin, {
        hostHeader: `example.test:${preview.port}`
      });
      assert.equal(evilHost.status, 421);
      assertSecurityHeaders(evilHost);

      const traversalTargets = [
        '/../outside',
        '/%2e%2e/outside',
        '/.%2e/outside',
        '/safe%2f..%2foutside',
        '/safe%2fchild',
        '/safe%5c..%5coutside',
        '/%252e%252e%252foutside',
        '/%00outside',
        '/%',
        '/double//segment',
        '//example.test/path',
        'http://example.test/path'
      ];
      for (const requestPath of traversalTargets) {
        const response = await request(preview.origin, { requestPath });
        assert.equal(response.status, 400, requestPath);
        assertSecurityHeaders(response);
      }
      const wrongCase = await request(preview.origin, { requestPath: '/I18N/runtime.js' });
      assert.equal(wrongCase.status, 404);

      const sentinel = path.join(fixture, 'private-sentinel.txt');
      await fsp.writeFile(sentinel, 'must-not-be-served');
      const runtimePath = path.join(built.outputDirectory, 'i18n/runtime.js');
      await fsp.rm(runtimePath);
      await fsp.symlink(sentinel, runtimePath);
      const swappedFile = await request(preview.origin, { requestPath: '/i18n/runtime.js' });
      assert.equal(swappedFile.status, 500);
      assert.doesNotMatch(swappedFile.body.toString('utf8'), /must-not-be-served/);
      assertSecurityHeaders(swappedFile);

      if (process.platform !== 'win32') {
        const fifoPath = path.join(built.outputDirectory, 'i18n/locales/en-US.js');
        await fsp.rm(fifoPath);
        const fifo = spawnSync('mkfifo', [fifoPath], { encoding: 'utf8' });
        assert.equal(fifo.status, 0, fifo.stderr);
        const specialFile = await request(preview.origin, { requestPath: '/i18n/locales/en-US.js' });
        assert.equal(specialFile.status, 500);
        assertSecurityHeaders(specialFile);
      }
    } finally {
      await preview.close();
    }
  });
});

await test('shared static handler accepts only an explicit injected LAN Host allowlist', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const built = await buildWeb({ repositoryRoot: fixture });
    const deployment = await loadDeployment(built.outputDirectory);
    let server;
    server = http.createServer((incoming, response) => {
      createRequestHandler(deployment, server, { allowedHosts: ['lan-preview.test'] })(incoming, response)
        .catch(() => response.destroy());
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      const allowed = await request(origin, {
        hostHeader: `lan-preview.test:${address.port}`
      });
      assert.equal(allowed.status, 200);
      assertSecurityHeaders(allowed);
      const loopbackNotInAllowlist = await request(origin, {
        hostHeader: `127.0.0.1:${address.port}`
      });
      assert.equal(loopbackNotInAllowlist.status, 421);
      assertSecurityHeaders(loopbackNotInAllowlist);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});

await test('preview rejects external binding, symlink roots, and tampered deployment files', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const built = await buildWeb({ repositoryRoot: fixture });
    await assert.rejects(
      startPreviewServer({ rootDirectory: built.outputDirectory, host: '0.0.0.0', port: 0 }),
      /exactly 127\.0\.0\.1/
    );
    const linkedRoot = path.join(fixture, 'linked-preview-root');
    await fsp.symlink(built.outputDirectory, linkedRoot);
    await assert.rejects(loadDeployment(linkedRoot), /non-symlink directory/);

    const manifestPath = path.join(built.outputDirectory, contract.manifest);
    const originalManifest = await fsp.readFile(manifestPath);
    const missingRequiredManifest = JSON.parse(originalManifest.toString('utf8'));
    missingRequiredManifest.files = missingRequiredManifest.files.filter(item => item.path !== 'i18n/runtime.js');
    await fsp.rm(path.join(built.outputDirectory, 'i18n/runtime.js'));
    await fsp.writeFile(manifestPath, `${JSON.stringify(missingRequiredManifest, null, 2)}\n`);
    await assert.rejects(loadDeployment(built.outputDirectory), /contract-required file: i18n\/runtime\.js/);
    await copyFileWithParents(
      path.join(fixture, 'i18n/runtime.js'),
      path.join(built.outputDirectory, 'i18n/runtime.js')
    );
    await fsp.writeFile(manifestPath, originalManifest);

    const weakenedManifest = JSON.parse(originalManifest.toString('utf8'));
    weakenedManifest.securityHeaders['Content-Security-Policy'] += "; script-src 'unsafe-eval'";
    await fsp.writeFile(manifestPath, `${JSON.stringify(weakenedManifest, null, 2)}\n`);
    await assert.rejects(loadDeployment(built.outputDirectory), /securityHeaders does not match deployed contract/);
    await fsp.writeFile(manifestPath, originalManifest);

    await fsp.appendFile(path.join(built.outputDirectory, 'i18n/runtime.js'), '\n// tampered\n');
    await assert.rejects(loadDeployment(built.outputDirectory), /size does not match manifest|hash does not match manifest/);
  });
});

await test('preview CLI reports readiness and shuts down cleanly on SIGTERM', async () => {
  await withTempDirectory(async fixture => {
    await createFixture(fixture);
    const built = await buildWeb({ repositoryRoot: fixture });
    const child = spawn(process.execPath, [
      path.join(repositoryRoot, 'scripts/preview-web.mjs'),
      '--root', built.outputDirectory,
      '--port', '0'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const exitPromise = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    try {
      const origin = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`preview CLI readiness timeout: ${stderr}`)), 5000);
        const inspect = () => {
          const match = stdout.match(/PreVision Web preview ready: (http:\/\/[^\s]+)/);
          if (!match) return;
          clearTimeout(timeout);
          resolve(match[1]);
        };
        child.stdout.on('data', inspect);
        child.once('exit', () => {
          clearTimeout(timeout);
          reject(new Error(`preview CLI exited before readiness: ${stderr}`));
        });
      });
      assert.equal((await request(origin)).status, 200);
      child.kill('SIGTERM');
      const result = await Promise.race([
        exitPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('preview CLI shutdown timeout')), 5000))
      ]);
      assert.equal(result.code, 0);
      assert.match(stdout, /preview stopped \(SIGTERM\)/);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  });
});

console.log(`\nWeb runtime result: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
