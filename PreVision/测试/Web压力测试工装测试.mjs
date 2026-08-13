/*
 * PreVision Web real-browser stress harness contract tests.
 * These tests validate the harness without pretending to be real-machine evidence.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PAGE_BOOTSTRAP_SOURCE,
  aggregateProcessTree,
  buildPublicEvidence,
  classifyChromiumGpuInfo,
  createSyntheticStressOracle,
  discoverBrowser,
  inspectStressEnvironment,
  parseStressArguments,
  publishEvidenceAtomically,
  readStressMatrix,
  selectOwnedWindowsProcesses,
  validatePublicEvidence,
  validateSyntheticActiveSceneIdentity,
  validateSyntheticStressProject,
  validateStressMatrix
} from '../scripts/web-stress-lib.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

console.log('· Web real-browser stress harness');

await test('Chromium GPU classification uses the active renderer and does not reject hybrid adapters for a fallback device', () => {
  const hybrid = classifyChromiumGpuInfo({ gpu: {
    devices: [
      { vendorString: 'Intel', deviceString: 'Integrated Graphics' },
      { vendorString: 'NVIDIA', deviceString: 'Discrete Graphics' },
      { vendorString: 'Google', deviceString: 'SwiftShader Device' }
    ],
    auxAttributes: { glVendor: 'Google Inc. (NVIDIA)', glRenderer: 'ANGLE (NVIDIA, Direct3D11)' }
  } });
  assert.equal(hybrid.softwareRenderingDetected, false);
  assert.equal(hybrid.category, 'hardware-unspecified');
  assert.equal(hybrid.deviceCount, 3);

  const actualSoftware = classifyChromiumGpuInfo({ gpu: {
    devices: [{ vendorString: 'NVIDIA', deviceString: 'Discrete Graphics' }],
    auxAttributes: { glVendor: 'Google Inc.', glRenderer: 'ANGLE (Google, Vulkan SwiftShader)' }
  } });
  assert.equal(actualSoftware.softwareRenderingDetected, true);
  assert.equal(actualSoftware.category, 'software');

  const softwareOnlyFallback = classifyChromiumGpuInfo({ gpu: {
    devices: [
      { vendorString: 'Google', deviceString: 'SwiftShader Device' },
      { vendorString: 'Microsoft', deviceString: 'Basic Render Driver' }
    ]
  } });
  assert.equal(softwareOnlyFallback.softwareRenderingDetected, true);
});

await test('matrix requires the four real browser/OS pairs and the complete scenario order', async () => {
  const matrix = await readStressMatrix({ repositoryRoot });
  assert.equal(matrix.runtimeMode, 'real-browser-loopback');
  assert.deepEqual(
    matrix.requiredPlatforms.map(item => `${item.os}:${item.browser}`),
    ['macOS:chrome', 'macOS:safari', 'Windows:chrome', 'Windows:edge']
  );
  assert(matrix.requiredPlatforms.every(item => item.realMachineRequired));
  assert.equal(matrix.resultSchema, 'qa/web-stress-evidence-schema.json');
  assert.deepEqual(matrix.scenarioOrder, [
    'default-load', 'typical-multi-object', 'panorama-4096x2048', 'repeated-scene-switch',
    'short-shot-playback', 'screenshot-export', 'short-recording', 'seedance-export', 'long-session'
  ]);
  assert.deepEqual(matrix.requiredMetrics, [
    'navigation-timing', 'js-heap', 'browser-process-memory-with-platform-semantics',
    'gpu-webgl', 'fps-and-dropped-frame-estimate', 'peak-memory', 'long-session-growth',
    'crash', 'webgl-context-lost'
  ]);
  assert.deepEqual(matrix.typicalScene, { objectCount: 24, sceneCount: 4 });
  assert.deepEqual(matrix.panorama, { width: 4096, height: 2048, ratio: '2:1', format: 'image/jpeg' });
  assert.equal(matrix.viewport.outerWidth, 1440);
  assert.equal(matrix.viewport.outerHeight, 900);
  assert.equal(matrix.profiles.standard.longSessionDurationMs, 120000);
  assert.equal(matrix.evidence.ciOrEmulationCountsAsRealMachine, false);
  assert.equal(Object.hasOwn(matrix.panorama, 'maximumWidth'), false);
  assert.equal(Object.hasOwn(matrix.profiles.standard, 'recordingLimitSeconds'), false);
});

await test('matrix validation rejects simulated evidence and missing panorama coverage', async () => {
  const matrix = await readStressMatrix({ repositoryRoot });
  const simulated = structuredClone(matrix);
  simulated.evidence.ciOrEmulationCountsAsRealMachine = true;
  assert.throws(() => validateStressMatrix(simulated), /CI or emulation/);
  const reducedPanorama = structuredClone(matrix);
  reducedPanorama.panorama.width = 2048;
  assert.throws(() => validateStressMatrix(reducedPanorama), /4096x2048/);
  const reordered = structuredClone(matrix);
  [reordered.scenarioOrder[0], reordered.scenarioOrder[1]] = [reordered.scenarioOrder[1], reordered.scenarioOrder[0]];
  assert.throws(() => validateStressMatrix(reordered), /exactly match/);
  const unknownMetric = structuredClone(matrix);
  unknownMetric.requiredMetrics.push('invented-metric');
  assert.throws(() => validateStressMatrix(unknownMetric), /requiredMetrics/);
  const stringTiming = structuredClone(matrix);
  stringTiming.profiles.standard.memorySampleMs = '500';
  assert.throws(() => validateStressMatrix(stringTiming), /positive number/);
});

await test('CLI accepts only fixed browsers, profiles, and ignored evidence paths', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');
  assert.deepEqual(parseStressArguments(['--browser', 'chrome', '--profile', 'smoke'], { now }), {
    check: false,
    browser: 'chrome',
    profile: 'smoke',
    attestation: 'unattested',
    output: 'dist/web-stress-evidence/chrome-smoke-2026-07-15T00-00-00-000Z.json'
  });
  assert.equal(
    parseStressArguments(['--browser', 'chrome', '--attestation', 'physical-machine'], { now }).attestation,
    'physical-machine'
  );
  assert.throws(() => parseStressArguments([], { now }), /--browser is required/);
  assert.throws(() => parseStressArguments(['--browser', 'firefox'], { now }), /--browser must be one of/);
  assert.throws(() => parseStressArguments(['--browser', 'chrome', '--attestation', 'guessed'], { now }), /--attestation must be one of/);
  assert.throws(
    () => parseStressArguments(['--browser', 'chrome', '--output', '../evidence.json'], { now }),
    /unsafe segment|must be a \.json child/
  );
  assert.throws(
    () => parseStressArguments(['--browser', 'chrome', '--output', 'docs/evidence.json'], { now }),
    /must be a \.json child/
  );
  for (const unsafe of [
    'dist/web-stress-evidence/foo:bar.json',
    'dist/web-stress-evidence/CON.json',
    'dist/web-stress-evidence/result?.json',
    'dist/web-stress-evidence/folder /result.json'
  ]) {
    assert.throws(() => parseStressArguments(['--browser', 'chrome', '--output', unsafe], { now }), /Windows|reserved/);
  }
});

await test('process aggregation includes only the owned browser tree', () => {
  const aggregate = aggregateProcessTree([
    { pid: 100, ppid: 1, memoryBytes: 1000, name: 'browser' },
    { pid: 101, ppid: 100, memoryBytes: 2000, name: 'renderer' },
    { pid: 102, ppid: 101, memoryBytes: 3000, name: 'gpu' },
    { pid: 200, ppid: 1, memoryBytes: 999999, name: 'unrelated' }
  ], 100);
  assert.deepEqual(aggregate, { memoryBytes: 6000, processCount: 3 });
});

await test('Windows cleanup rediscovers orphaned Chromium and Crashpad processes by the unique profile', () => {
  const profile = 'C:\\Users\\tester\\AppData\\Local\\Temp\\prevision-chrome-stress-AbC123';
  const processes = [
    { pid: 100, commandLine: `chrome.exe --user-data-dir="${profile}"` },
    { pid: 101, commandLine: `crashpad_handler.exe --database=${profile}\\Crashpad` },
    { pid: 102, commandLine: 'chrome.exe --user-data-dir=C:\\Users\\tester\\ordinary-profile' },
    { pid: 103, commandLine: 'powershell.exe -NoProfile' },
    { pid: 104, commandLine: `chrome.exe --user-data-dir=${profile}-unrelated-sibling` }
  ];
  assert.deepEqual(selectOwnedWindowsProcesses(processes, profile).map(item => item.pid), [100, 101]);
  assert.throws(
    () => selectOwnedWindowsProcesses(processes, 'C:\\Users\\tester\\ordinary-profile'),
    /recognized stress profile/
  );
});

await test('environment report separates Safari installation from authorization and omits executable paths', async () => {
  const environment = await inspectStressEnvironment();
  const serialized = JSON.stringify(environment);
  assert.equal(Object.hasOwn(environment.browsers.chrome, 'executable'), false);
  assert.equal(Object.hasOwn(environment.browsers.safari, 'automationAuthorized'), true);
  assert.doesNotMatch(serialized, /\/Applications\/|\/Users\/|\\Users\\/);
  const impossibleSafari = await discoverBrowser('safari', { platform: 'win32', environment: {} });
  assert.equal(impossibleSafari.available, false);
  assert.equal(impossibleSafari.platformAllowed, false);
  const macEdge = await discoverBrowser('edge', { platform: 'darwin', environment: {} });
  assert.equal(macEdge.available, false);
  assert.equal(macEdge.platformAllowed, false);
  assert.match(macEdge.blocker, /macOS Edge/);
  const linuxChrome = await discoverBrowser('chrome', { platform: 'linux', environment: {} });
  assert.equal(linuxChrome.available, false);
  assert.equal(linuxChrome.platformAllowed, false);
  const windowsCi = await inspectStressEnvironment({ platform: 'win32', environment: { CI: '1' } });
  assert.equal(windowsCi.windowsTargetOsAvailable, true);
  assert.equal(windowsCi.windowsRealMachineAvailable, false);
  assert.equal(windowsCi.windowsEvidenceEligible, false);
  assert.match(windowsCi.windowsBlocker, /CI is structural coverage only/);
});

await test('page bridge covers all workflows without changing WebGL recovery behavior', async () => {
  const matrix = await readStressMatrix({ repositoryRoot });
  for (const scenario of matrix.scenarioOrder) assert(PAGE_BOOTSTRAP_SOURCE.includes(`'${scenario}'`), scenario);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /playButton\.click\(\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /document\.getElementById\('snap'\)\.click\(\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /recordBlob\(config\.profile\.recordingSeconds/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /seedancePack/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /canvas\.width = config\.panorama\.width/);
  assert.doesNotMatch(PAGE_BOOTSTRAP_SOURCE, /preventDefault\(\)/);
});

await test('synthetic 4-scene fixture rejects dangling A/B references and fail-closes against an immutable oracle', () => {
  const actor = (index, sceneIndex) => ({
    kind: 'prop',
    label: `Stress Object ${String(index + 1).padStart(2, '0')}`,
    pos: [index + sceneIndex * .25, index + sceneIndex * .2],
    path: index % 3 === 0 ? [[index + sceneIndex * .25, index], [index + 1 + sceneIndex * .25, index + 1]] : []
  });
  const fixture = {
    app: 'PreVision',
    version: 5,
    name: 'Synthetic Web Stress Project',
    scenes: Array.from({ length: 4 }, (_, sceneIndex) => ({
      name: `Synthetic Stress Scene ${sceneIndex + 1}`,
      actors: Array.from({ length: 24 }, (_, actorIndex) => actor(actorIndex, sceneIndex)),
      shots: Array.from({ length: 4 }, (_, shotIndex) => ({
        name: `Shot ${shotIndex + 1}`,
        lock: `Stress Object ${String(shotIndex + 1).padStart(2, '0')}`,
        syncActor: '',
        dur: 1,
        cam: [[0, 1, 2]]
      }))
    }))
  };
  const summary = validateSyntheticStressProject(fixture);
  assert.equal(summary.sceneCount, 4);
  assert(summary.scenes.every(scene => scene.actorLabels.length === 24));
  assert.deepEqual(summary.scenes[0].shotLocks, [
    'Stress Object 01', 'Stress Object 02', 'Stress Object 03', 'Stress Object 04'
  ]);

  const legacyLocks = structuredClone(fixture);
  legacyLocks.scenes[0].shots[0].lock = 'A';
  legacyLocks.scenes[0].shots[1].lock = 'B';
  assert.throws(() => validateSyntheticStressProject(legacyLocks), /dangling camera lock reference: A/);
  const danglingSync = structuredClone(fixture);
  danglingSync.scenes[1].shots[0].syncActor = 'B';
  assert.throws(() => validateSyntheticStressProject(danglingSync), /dangling camera sync reference: B/);
  const oracle = createSyntheticStressOracle(fixture);
  assert(Object.isFrozen(oracle) && Object.isFrozen(oracle.scenes[0].actors[0].path), 'synthetic oracle is deeply immutable');
  const runtimeFor = scene => scene.actors.map(actorData => ({
    label: actorData.label,
    kind: actorData.kind,
    pathPts: actorData.path.map(([x, z]) => ({ x, z })),
    obj: { position: { x: actorData.path.length ? actorData.path[0][0] : actorData.pos[0], z: actorData.path.length ? actorData.path[0][1] : actorData.pos[1] } }
  }));
  assert.deepEqual(validateSyntheticActiveSceneIdentity(oracle, fixture, runtimeFor(fixture.scenes[2]), 2, 2, 'positive oracle check'), { sceneCount: 4, objectCount: 24 });
  const staleLiveProject = structuredClone(fixture), staleSceneIndex = 2;
  staleLiveProject.scenes[staleSceneIndex].actors = structuredClone(staleLiveProject.scenes[staleSceneIndex - 1].actors);
  const staleRuntime = runtimeFor(staleLiveProject.scenes[staleSceneIndex]);
  assert(staleRuntime.every((actorData, actorIndex) => actorData.label === staleLiveProject.scenes[staleSceneIndex].actors[actorIndex].label),
    'legacy live-project expected data would self-approve the stale runtime');
  assert.throws(
    () => validateSyntheticActiveSceneIdentity(oracle, staleLiveProject, staleRuntime, staleSceneIndex, staleSceneIndex, 'stale live/runtime pair'),
    /Synthetic live actor identity changed/,
    'immutable oracle rejects a live target scene and runtime that were both replaced by the previous scene'
  );
  const staleRuntimeOnly = runtimeFor(fixture.scenes[staleSceneIndex - 1]);
  assert.throws(
    () => validateSyntheticActiveSceneIdentity(oracle, fixture, staleRuntimeOnly, staleSceneIndex, staleSceneIndex, 'stale runtime only'),
    /Synthetic runtime actor identity changed/,
    'runtime oracle branch independently rejects the previous scene even while the live project remains correct'
  );
  assert.notEqual(oracle.scenes[0].actors[0].path, fixture.scenes[0].actors[0].path, 'oracle path arrays are independent copies');
  const oracleFirstPathX = oracle.scenes[0].actors[0].path[0][0];
  fixture.scenes[0].actors[0].path[0][0] += 1000;
  assert.equal(oracle.scenes[0].actors[0].path[0][0], oracleFirstPathX, 'mutating the source fixture cannot change the oracle');
  assert.match(PAGE_BOOTSTRAP_SOURCE, /validateSyntheticFixture\(data, config\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /syntheticSceneOracle = createSyntheticOracle\(data\)[\s\S]*openProjectData\(data\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /openProjectData\(data\) !== true/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /validateSyntheticFixture\(project, config\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /loadScene\(expectedSceneIndex\)[\s\S]*verifyActiveSyntheticScene\(config, expectedSceneIndex/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /validateSyntheticActiveScene\(syntheticSceneOracle, project, actors, expectedSceneIndex, sceneIdx, context\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /pathMatches\(runtimePath, expectedActor\.path, true\)/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /runtimePath\.length === 0[\s\S]*actor\?\.obj\?\.position\?\.x, expectedActor\.pos\[0\]/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /verifiedSceneIndexes\.size !== config\.typicalScene\.sceneCount/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /verifyActiveSyntheticScene\(config, expectedSceneIndex, `long-session cycle/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /Long session did not verify every synthetic scene identity/);
  assert.match(PAGE_BOOTSTRAP_SOURCE, /state\.alertCount !== alertCountBefore/);
});

await test('public evidence is fail-closed for unknown, secret, project, path, and null scenario data', async () => {
  const schema = JSON.parse(await fsp.readFile(path.join(repositoryRoot, 'qa/web-stress-evidence-schema.json'), 'utf8'));
  const sha = 'a'.repeat(64);
  const privateRoot = ['', 'Users', 'private'].join('/');
  const scenarioOrder = [
    'default-load', 'typical-multi-object', 'panorama-4096x2048', 'repeated-scene-switch',
    'short-shot-playback', 'screenshot-export', 'short-recording', 'seedance-export', 'long-session'
  ];
  const artifactForScenario = id => {
    if (id === 'screenshot-export') return {
      kind: 'screenshot-png', size: 100, type: 'image/png',
      validation: { status: 'passed', format: 'png', signatureValid: true, width: 1920, height: 1080 }
    };
    if (id === 'short-recording') return {
      kind: 'recording-video', size: 200, type: 'video/mp4;codecs=avc1', extension: '.mp4',
      validation: { status: 'passed', format: 'mp4', signatureValid: true }
    };
    if (id === 'seedance-export') return {
      kind: 'seedance-zip', size: 300, type: 'application/zip',
      validation: {
        status: 'passed', format: 'zip', signatureValid: true, centralDirectoryFound: true,
        entryCount: 5, expectedEntriesPresent: true, allEntriesNonEmpty: true
      }
    };
    return null;
  };
  const raw = {
    sourceCommit: 'b'.repeat(40),
    harness: { files: {
      'scripts/web-stress-lib.mjs': sha,
      'scripts/run-web-stress.mjs': sha,
      'qa/web-stress-matrix.json': sha,
      'qa/web-stress-evidence-schema.json': sha
    } },
    profile: 'smoke',
    environment: {
      operatingSystem: 'Test OS', platform: 'darwin', architecture: 'arm64', browser: { name: 'chrome', version: '1', automation: 'cdp' },
      ci: false, executionEnvironment: 'local-physical-machine', targetOsBrowserPair: true,
      realMachineAttestation: 'physical-machine', matrixEvidenceEligible: true,
      evidenceEligibilityBasis: 'operator-attested-physical-machine',
      secret: 'TOP-SECRET', executable: `${privateRoot}/Chrome`
    },
    runtime: {
      staticBuildHomeMode: 'director-fallback', deploymentManifestSha256: sha, directorSha256: sha,
      renderSchedulingControl: 'headful-background-throttling-disabled-visibility-still-observed',
      browserExternalNetworkControl: 'closed-loopback-browser-and-process-proxy-plus-host-resolver-deny',
      browserIsolation: 'temporary-user-data-directory'
    },
    parameters: {
      profile: {
        settleMs: 1, memorySampleMs: 1, sceneSwitchIterations: 1, fpsSampleMs: 1,
        playbackMs: 1, recordingSeconds: 1, longSessionDurationMs: 1,
        longSessionActionIntervalMs: 1, cooldownMs: 1
      },
      panorama: { width: 4096, height: 2048, ratio: '2:1', format: 'image/jpeg' },
      typicalScene: { objectCount: 24, sceneCount: 4 },
      viewport: { outerWidth: 1440, outerHeight: 900 }
    },
    bootstrap: { ready: true, navigation: {}, page: {} },
    browserSystem: {
      status: 'measured', source: 'cdp-system-info', deviceCount: 1,
      category: 'apple-silicon-or-apple-gpu', softwareRenderingDetected: false
    },
    scenarios: scenarioOrder.map((id, index) => ({
      id, status: index === 0 ? 'failed' : 'passed', failureReasonCode: index === 0 ? 'scenario-error' : null,
      page: {
        before: index === 0 ? { viewport: { canvasPixels: [{ id: 'gl', width: 1920, height: 1080 }] } } : null,
        after: null,
        heapSamples: [{ usedJSHeapSize: 1, secret: 'TOP-SECRET' }]
      },
      details: id === 'screenshot-export' ? { output: artifactForScenario(id) }
        : id === 'short-recording' || id === 'seedance-export'
          ? { durationSeconds: 1, output: artifactForScenario(id) }
          : null,
      events: { errorCodes: ['future-private-error'], outputs: artifactForScenario(id) ? [artifactForScenario(id)] : [] },
      processMemory: { status: 'unsupported' },
      projectName: 'Synthetic Web Stress Project', secret: 'TOP-SECRET'
    })),
    memory: {}, processMemorySampling: {}, processSamples: [{ memoryBytes: 1, commandLine: 'TOP-SECRET' }],
    browserEvents: {
      consoleCollection: 'measured', consoleErrorCount: 0, exceptionCount: 0,
      crashStatus: 'not-observed', detachedStatus: 'not-observed'
    },
    verdict: {
      completed: false, matrixEvidenceEligible: true, evidenceEligibilityBasis: 'operator-attested-physical-machine',
      failedScenarios: ['default-load'], crash: { status: 'not-observed', detection: 'cdp-target-and-owned-process' },
      webglContextLost: { status: 'not-observed', count: 0 }
    },
    cleanup: { status: 'passed', errors: [], pageTeardown: { cleaned: true, errorCodes: [] } },
    secret: 'TOP-SECRET'
  };
  const evidence = buildPublicEvidence(raw, [privateRoot]);
  assert.doesNotThrow(() => validatePublicEvidence(evidence, schema));
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /TOP-SECRET|Synthetic Web Stress Project|\/Users\/private|projectName|commandLine/);
  assert.equal(evidence.scenarios[0].details.navigation.responseStartMs, null);
  assert.deepEqual(evidence.scenarios[0].page.before.viewport.mainCanvas, { width: 1920, height: 1080 });
  const topLevelInjection = structuredClone(evidence);
  topLevelInjection.secret = 'TOP-SECRET';
  assert.throws(() => validatePublicEvidence(topLevelInjection, schema), /not allowed/);
  const nestedInjection = structuredClone(evidence);
  nestedInjection.scenarios[0].secret = 'TOP-SECRET';
  assert.throws(() => validatePublicEvidence(nestedInjection, schema), /not allowed/);
  const environmentInjection = structuredClone(evidence);
  environmentInjection.environment.futurePrivate = 'TOP-SECRET';
  assert.throws(() => validatePublicEvidence(environmentInjection, schema), /not allowed/);
  const missingNestedField = structuredClone(evidence);
  delete missingNestedField.environment.platform;
  assert.throws(() => validatePublicEvidence(missingNestedField, schema), /platform is required/);
  const illegalEnum = structuredClone(evidence);
  illegalEnum.environment.platform = 'linux';
  assert.throws(() => validatePublicEvidence(illegalEnum, schema), /allowed values/);
  const incomplete = structuredClone(evidence);
  incomplete.scenarios.pop();
  assert.throws(() => validatePublicEvidence(incomplete, schema), /complete fixed scenario order/);
  const contradictoryEligibility = structuredClone(evidence);
  contradictoryEligibility.environment.ci = true;
  contradictoryEligibility.environment.executionEnvironment = 'ci';
  assert.throws(() => validatePublicEvidence(contradictoryEligibility, schema), /eligibility fields are inconsistent/);
  const falseCompletion = structuredClone(evidence);
  falseCompletion.verdict.completed = true;
  assert.throws(() => validatePublicEvidence(falseCompletion, schema), /Completed public evidence/);
  const invalidArtifactSignature = structuredClone(evidence);
  invalidArtifactSignature.scenarios.find(item => item.id === 'screenshot-export')
    .details.output.validation.signatureValid = false;
  assert.throws(() => validatePublicEvidence(invalidArtifactSignature, schema), /signature-validated artifact/);
  const invalidMatrixBrowser = structuredClone(evidence);
  invalidMatrixBrowser.environment.browser.name = 'edge';
  assert.throws(() => validatePublicEvidence(invalidMatrixBrowser, schema), /required OS\/browser matrix pair/);
  const invalidAutomation = structuredClone(evidence);
  invalidAutomation.environment.browser.automation = 'webdriver';
  assert.throws(() => validatePublicEvidence(invalidAutomation, schema), /required OS\/browser matrix pair/);
  const leafObjectInjection = structuredClone(evidence);
  leafObjectInjection.parameters.panorama.width = { futurePrivate: 'TOP-SECRET' };
  assert.throws(() => validatePublicEvidence(leafObjectInjection, schema), /constant|wrong type/);
  const missingUnsupportedReason = structuredClone(evidence);
  missingUnsupportedReason.memory.jsHeapReasonCode = null;
  assert.throws(() => validatePublicEvidence(missingUnsupportedReason, schema), /fixed reason/);
  const nullAttestation = structuredClone(evidence);
  nullAttestation.environment.realMachineAttestation = null;
  assert.throws(() => validatePublicEvidence(nullAttestation, schema), /allowed values/);
  assert.equal(evidence.scenarios.find(item => item.id === 'short-recording').details.output.kind, 'recording-video');
  assert.equal(evidence.scenarios.find(item => item.id === 'short-recording').details.output.extension, 'mp4');

  const softwareEvidence = structuredClone(evidence);
  softwareEvidence.browserSystem.category = 'software';
  softwareEvidence.browserSystem.softwareRenderingDetected = true;
  softwareEvidence.environment.matrixEvidenceEligible = false;
  softwareEvidence.environment.evidenceEligibilityBasis = 'software-rendering-detected';
  softwareEvidence.verdict.matrixEvidenceEligible = false;
  softwareEvidence.verdict.evidenceEligibilityBasis = 'software-rendering-detected';
  assert.doesNotThrow(() => validatePublicEvidence(softwareEvidence, schema));

  const gpuUnavailableEvidence = structuredClone(evidence);
  gpuUnavailableEvidence.browserSystem = {
    status: 'unsupported', source: 'cdp-system-info', deviceCount: null, category: null,
    softwareRenderingDetected: null, reasonCode: 'browser-gpu-diagnostics-unavailable'
  };
  gpuUnavailableEvidence.environment.matrixEvidenceEligible = false;
  gpuUnavailableEvidence.environment.evidenceEligibilityBasis = 'gpu-diagnostics-unavailable';
  gpuUnavailableEvidence.verdict.matrixEvidenceEligible = false;
  gpuUnavailableEvidence.verdict.evidenceEligibilityBasis = 'gpu-diagnostics-unavailable';
  assert.doesNotThrow(() => validatePublicEvidence(gpuUnavailableEvidence, schema));

  const approvedWindowsVm = structuredClone(evidence);
  approvedWindowsVm.environment.platform = 'win32';
  approvedWindowsVm.environment.architecture = 'x64';
  approvedWindowsVm.environment.browser = { name: 'edge', version: '1', automation: 'cdp' };
  approvedWindowsVm.environment.executionEnvironment = 'approved-3d-gpu-vm';
  approvedWindowsVm.environment.realMachineAttestation = 'approved-3d-gpu-vm';
  approvedWindowsVm.environment.evidenceEligibilityBasis = 'operator-attested-approved-3d-gpu-vm';
  approvedWindowsVm.verdict.evidenceEligibilityBasis = 'operator-attested-approved-3d-gpu-vm';
  assert.doesNotThrow(() => validatePublicEvidence(approvedWindowsVm, schema));
  const unapprovedMacVm = structuredClone(approvedWindowsVm);
  unapprovedMacVm.environment.platform = 'darwin';
  unapprovedMacVm.environment.browser = { name: 'chrome', version: '1', automation: 'cdp' };
  assert.throws(() => validatePublicEvidence(unapprovedMacVm, schema), /only valid for the Windows matrix/);

  const notRunRaw = structuredClone(raw);
  const finalScenario = notRunRaw.scenarios.at(-1);
  finalScenario.status = 'not-run';
  finalScenario.failureReasonCode = 'browser-terminated-before-scenario';
  finalScenario.startedAt = null;
  finalScenario.endedAt = null;
  notRunRaw.verdict.failedScenarios = ['default-load', 'long-session'];
  const notRunEvidence = buildPublicEvidence(notRunRaw, [privateRoot]);
  assert.doesNotThrow(() => validatePublicEvidence(notRunEvidence, schema));
  assert.equal(notRunEvidence.scenarios.at(-1).startedAt, null);
  assert.equal(notRunEvidence.scenarios.at(-1).endedAt, null);

  const contextLostEvidence = structuredClone(evidence);
  contextLostEvidence.verdict.completed = false;
  contextLostEvidence.verdict.webglContextLost = { status: 'observed', count: 1, observationDurationMs: 1 };
  assert.doesNotThrow(() => validatePublicEvidence(contextLostEvidence, schema));
});

await test('tracked macOS Chrome standard evidence matches its recorded strict harness identity', async () => {
  const evidencePath = path.join(
    repositoryRoot,
    'docs/qa/web-cross-platform-stress/evidence/macos-chrome-standard.json'
  );
  const [evidenceText, schemaText] = await Promise.all([
    fsp.readFile(evidencePath, 'utf8'),
    fsp.readFile(path.join(repositoryRoot, 'qa/web-stress-evidence-schema.json'), 'utf8')
  ]);
  const evidence = JSON.parse(evidenceText);
  const schema = JSON.parse(schemaText);
  assert.doesNotThrow(() => validatePublicEvidence(evidence, schema));
  assert.equal(evidence.profile, 'standard');
  assert.equal(evidence.environment.realMachineAttestation, 'physical-machine');
  assert.equal(evidence.verdict.completed, true);
  assert.equal(evidence.verdict.matrixEvidenceEligible, true);
  assert.equal(evidence.cleanup.status, 'passed');
  for (const [relativePath, expectedHash] of Object.entries(evidence.harness.files)) {
    const historical = spawnSync('git', ['show', `${evidence.sourceCommit}:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: null,
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.equal(historical.status, 0, `${relativePath}: ${historical.stderr?.toString('utf8') || 'git show failed'}`);
    assert.equal(crypto.createHash('sha256').update(historical.stdout).digest('hex'), expectedHash, relativePath);
  }
  assert.doesNotMatch(
    evidenceText,
    /\/Users\/|\/home\/|[A-Za-z]:\\Users\\|Synthetic Web Stress Project|Stress Object|sessionId|webSocketDebuggerUrl/
  );
});

await test('evidence publication never overwrites a concurrent target and removes partial files on abort', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'prevision-evidence-publish-test-'));
  try {
    const occupied = path.join(directory, 'occupied.json');
    await fsp.writeFile(occupied, 'existing\n');
    await assert.rejects(() => publishEvidenceAtomically(occupied, 'replacement\n'), /EEXIST|exists/i);
    assert.equal(await fsp.readFile(occupied, 'utf8'), 'existing\n');
    assert.equal((await fsp.readdir(directory)).some(name => name.includes('.partial-')), false);
    const aborted = path.join(directory, 'aborted.json');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => publishEvidenceAtomically(aborted, '{}\n', { signal: controller.signal }), /interrupted/);
    await assert.rejects(() => fsp.access(aborted), /ENOENT/);
    assert.equal((await fsp.readdir(directory)).some(name => name.includes('.partial-')), false);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});

await test('Chromium uses a private CDP pipe and Safari enablement is never automated', async () => {
  const source = await fsp.readFile(path.join(repositoryRoot, 'scripts/web-stress-lib.mjs'), 'utf8');
  assert.match(source, /--remote-debugging-pipe/);
  assert.doesNotMatch(source, /--remote-debugging-port/);
  assert.match(source, /--disable-crash-reporter/);
  assert.match(source, /--disable-background-timer-throttling/);
  assert.match(source, /--disable-backgrounding-occluded-windows/);
  assert.match(source, /--disable-renderer-backgrounding/);
  assert.match(source, /--crash-dumps-dir=/);
  assert.match(source, /CFFIXED_USER_HOME: profilePath/);
  assert.match(source, /CFBundleShortVersionString/);
  assert.doesNotMatch(source, /spawnSync\(executable, \['--version'\]/);
  assert.match(source, /--host-resolver-rules=MAP \* ~NOTFOUND, EXCLUDE 127\.0\.0\.1/);
  assert.match(source, /--proxy-server=http:\/\/127\.0\.0\.1:9/);
  assert.match(source, /--proxy-bypass-list=127\.0\.0\.1;localhost/);
  assert.match(source, /closed-loopback-browser-and-process-proxy-plus-host-resolver-deny/);
  assert.doesNotMatch(source, /\[['\"]--enable['\"]\]/);
  assert.doesNotMatch(source, /\(0, eval\)/);
  assert.match(source, /runScenario\(id, config\)/);
  assert.match(source, /Browser\.setDownloadBehavior', \{ behavior: 'deny'/);
  assert.match(source, /detached: process\.platform !== 'win32'/);
  assert.match(source, /process\.kill\(-child\.pid, 'SIGKILL'\)/);
  assert.match(source, /expectedDatabaseArgument/);
  assert.match(source, /terminateOwnedCrashHelpers\(profilePath\)/);
  assert.match(source, /PREVISION_STRESS_OWNED_PROFILE/);
  assert.match(source, /windowsOwnedProcessTable\(profilePath\)/);
  assert.match(source, /await fsp\.link\(partialAbsolute, evidenceAbsolute\)/);
  assert((source.match(/throwIfAborted\(\)/g) || []).length >= 6);
  assert.match(source, /startPreviewServer\(\{ rootDirectory: buildResult\.outputDirectory, port: 0 \}\)/);
});

await test('check mode is read-only JSON and does not claim Windows on macOS', () => {
  const result = spawnSync(process.execPath, ['scripts/run-web-stress.mjs', '--check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.matrix.taskId, '04.web-cross-platform-stress');
  if (process.platform !== 'win32') {
    assert.equal(report.environment.windowsRealMachineAvailable, false);
    assert.match(report.environment.windowsBlocker, /not running on a real Windows installation/);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
