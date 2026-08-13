#!/usr/bin/env node
import { buildWeb } from './web-runtime-lib.mjs';

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--output') {
      options.outputDirectory = args[index += 1];
      if (!options.outputDirectory) throw new Error('--output requires a repository-relative directory');
    } else if (argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run web:build -- [--output dist/web]');
    process.exit(0);
  }
  const result = await buildWeb({ outputDirectory: options.outputDirectory });
  console.log(`PreVision Web static output: ${result.outputRelative}`);
  console.log(`Home mode: ${result.homeMode}`);
  console.log(`Manifest files: ${result.manifest.files.length}`);
  if (result.cleanupWarning) console.warn(result.cleanupWarning);
} catch (error) {
  console.error(`PreVision Web build failed: ${error.message}`);
  process.exit(1);
}
