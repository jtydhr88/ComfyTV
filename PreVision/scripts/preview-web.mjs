#!/usr/bin/env node
import path from 'node:path';
import { DEFAULT_REPOSITORY_ROOT, startPreviewServer } from './web-runtime-lib.mjs';

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--host') options.host = args[index += 1];
    else if (argument === '--port') options.port = args[index += 1];
    else if (argument === '--root') options.root = args[index += 1];
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
    if (!options.help && ['--host', '--port', '--root'].includes(argument) && !args[index]) {
      throw new Error(`${argument} requires a value`);
    }
  }
  return options;
}

let preview;
try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run web:preview -- [--host 127.0.0.1] [--port 4173] [--root dist/web]');
    process.exit(0);
  }
  preview = await startPreviewServer({
    rootDirectory: path.resolve(DEFAULT_REPOSITORY_ROOT, options.root || 'dist/web'),
    host: options.host || '127.0.0.1',
    port: options.port ?? 4173
  });
  console.log(`PreVision Web preview ready: ${preview.origin}`);
} catch (error) {
  console.error(`PreVision Web preview failed: ${error.message}`);
  process.exit(1);
}

async function shutdown(signal) {
  try {
    await preview.close();
    console.log(`PreVision Web preview stopped (${signal})`);
    process.exit(0);
  } catch (error) {
    console.error(`PreVision Web preview shutdown failed: ${error.message}`);
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
