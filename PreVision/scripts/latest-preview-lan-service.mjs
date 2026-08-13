import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLanPreviewService } from './latest-preview-lan-runtime.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_PATH);
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{3,100}$/;

function errorCode(error) {
  return SAFE_ERROR_CODE_PATTERN.test(error?.code || '')
    ? error.code
    : 'LAN_SERVICE_START_FAILED';
}

export async function runLatestPreviewLanService({
  homeDirectory = os.homedir(),
  resourcesDirectory = SCRIPT_DIRECTORY,
  networkOptions = {}
} = {}) {
  const service = await startLanPreviewService({
    homeDirectory,
    resourcesDirectory,
    networkOptions
  });
  let stopping = false;
  const stop = async signal => {
    if (stopping) return;
    stopping = true;
    await service.manager.writeState({
      ...service.manager.lastState,
      status: 'stopping',
      errorCode: null,
      updatedAt: new Date().toISOString()
    }).catch(() => {});
    const timeout = setTimeout(() => {
      process.exitCode = 70;
    }, service.lanPolicy.service.shutdownGraceMilliseconds);
    timeout.unref();
    try {
      await service.close();
      await service.manager.writeState({
        ...service.manager.lastState,
        status: 'stopped',
        errorCode: null,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
      process.exitCode = signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : process.exitCode;
    } finally {
      clearTimeout(timeout);
    }
  };
  process.once('SIGTERM', () => {
    stop('SIGTERM').catch(() => {
      process.exitCode = 70;
    });
  });
  process.once('SIGINT', () => {
    stop('SIGINT').catch(() => {
      process.exitCode = 70;
    });
  });
  return { ...service, stop };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  try {
    const service = await runLatestPreviewLanService();
    process.stdout.write(`LAN_PREVIEW_READY ${service.network.hostname}:${service.network.port}\n`);
  } catch (error) {
    process.stderr.write(`${errorCode(error)}\n`);
    process.exitCode = 1;
  }
}
