#!/usr/bin/env node
import {
  inspectStressEnvironment,
  parseStressArguments,
  readStressMatrix,
  runWebStress
} from './web-stress-lib.mjs';

function assertSupportedNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 20 || major > 24) {
    throw new Error(`Web stress runs require Node 20-24; current ${process.version}`);
  }
}

function safeError(error) {
  return String(error?.message || error)
    .split(process.cwd()).join('<repository>')
    .replace(/(?:[A-Za-z]:\\Users\\[^\\\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+)/g, '<user-home>');
}

const abortController = new AbortController();
let interruptedSignal = null;
const signalHandlers = new Map();
for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const handler = () => {
    interruptedSignal ||= name;
    if (!abortController.signal.aborted) abortController.abort();
  };
  signalHandlers.set(name, handler);
  process.on(name, handler);
}

try {
  assertSupportedNode();
  const options = parseStressArguments(process.argv.slice(2));
  if (options.check) {
    const [environment, matrix] = await Promise.all([inspectStressEnvironment(), readStressMatrix()]);
    console.log(JSON.stringify({ environment, matrix }, null, 2));
  } else {
    const { result, evidencePath } = await runWebStress({
      browser: options.browser,
      profileName: options.profile,
      machineAttestation: options.attestation,
      outputPath: options.output,
      signal: abortController.signal,
      onProgress(update) {
        console.log(`[web-stress] ${update.phase}${update.id ? `/${update.id}` : ''}: ${update.message}`);
      }
    });
    console.log(`[web-stress] evidence: ${evidencePath}`);
    console.log(`[web-stress] completed=${result.verdict.completed} matrixEvidenceEligible=${result.verdict.matrixEvidenceEligible} crash=${result.verdict.crash.status} contextLost=${result.verdict.webglContextLost.count}`);
    if (!result.verdict.completed) process.exitCode = 2;
  }
} catch (error) {
  console.error(`[web-stress] ${safeError(error)}`);
  process.exitCode = interruptedSignal ? 130 : 1;
} finally {
  for (const [name, handler] of signalHandlers) process.removeListener(name, handler);
}

const finalExitCode = process.exitCode || 0;
await Promise.all([
  new Promise(resolve => process.stdout.write('', resolve)),
  new Promise(resolve => process.stderr.write('', resolve))
]);
process.exit(finalExitCode);
