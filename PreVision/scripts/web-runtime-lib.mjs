import fsp from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(moduleDirectory, '..');
export const DEFAULT_CONTRACT_PATH = 'web/runtime-contract.json';
export const DEPLOYMENT_MANIFEST_PATH = 'prevision-web-manifest.json';

function fail(message) {
  throw new Error(message);
}

function compareText(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function portablePathKey(value) {
  return value.normalize('NFC').toLocaleLowerCase('en-US');
}

export function validateRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || !value.length) fail(`${label} must be a non-empty relative path`);
  if (/[\u0000-\u001f\u007f?#%\\:*"<>|]/.test(value)) fail(`${label} contains a forbidden character`);
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) fail(`${label} must be relative`);
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    fail(`${label} must not contain empty, dot, or parent segments`);
  }
  if (segments.some(segment => /[. ]$/.test(segment) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))) {
    fail(`${label} is not portable across supported development platforms`);
  }
  if (path.posix.normalize(value) !== value) fail(`${label} is not normalized`);
  return value;
}

function resolveInside(root, relativePath, label) {
  const safePath = validateRelativePath(relativePath, label);
  const absolute = path.resolve(root, ...safePath.split('/'));
  const relation = path.relative(path.resolve(root), absolute);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) {
    if (!relation && safePath !== '.') return absolute;
    fail(`${label} resolves outside its root`);
  }
  return absolute;
}

async function assertRootDirectory(root, label) {
  const absolute = path.resolve(root);
  const stat = await fsp.lstat(absolute).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be an existing non-symlink directory`);
  return absolute;
}

async function inspectPath(root, relativePath, expectedType, label, optional = false) {
  const absolute = resolveInside(root, relativePath, label);
  let cursor = path.resolve(root);
  for (const segment of validateRelativePath(relativePath, label).split('/')) {
    cursor = path.join(cursor, segment);
    const stat = await fsp.lstat(cursor).catch(error => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (!stat) {
      if (optional) return null;
      fail(`Missing required ${label}: ${relativePath}`);
    }
    if (stat.isSymbolicLink()) fail(`${label} must not contain symbolic links: ${relativePath}`);
  }
  const stat = await fsp.lstat(absolute);
  if (expectedType === 'file' && !stat.isFile()) fail(`${label} must be a regular file: ${relativePath}`);
  if (expectedType === 'directory' && !stat.isDirectory()) fail(`${label} must be a directory: ${relativePath}`);
  return { absolute, stat };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

export function validateContract(contract) {
  assertPlainObject(contract, 'Web runtime contract');
  if (contract.schemaVersion !== 1) fail('Unsupported Web runtime contract schemaVersion');
  if (contract.mode !== 'static-web-runtime') fail('Web runtime contract mode must be static-web-runtime');
  validateRelativePath(contract.outputDirectory, 'outputDirectory');
  if (!contract.outputDirectory.startsWith('dist/')) fail('outputDirectory must be a child of dist/');
  validateRelativePath(contract.manifest, 'manifest');
  if (contract.manifest !== DEPLOYMENT_MANIFEST_PATH) fail(`manifest must be ${DEPLOYMENT_MANIFEST_PATH}`);
  validateRelativePath(contract.deployedContract, 'deployedContract');
  assertPlainObject(contract.home, 'home');
  validateRelativePath(contract.home.sourceDirectory, 'home.sourceDirectory');
  validateRelativePath(contract.home.entry, 'home.entry');
  if (contract.home.optional !== true || contract.home.fallback !== 'director') {
    fail('home must be optional and fall back to director');
  }
  if (!Array.isArray(contract.home.reservedTopLevel) || !contract.home.reservedTopLevel.length) {
    fail('home.reservedTopLevel must list protected output paths');
  }
  contract.home.reservedTopLevel.forEach((entry, index) => {
    validateRelativePath(entry, `home.reservedTopLevel[${index}]`);
    if (entry.includes('/')) fail(`home.reservedTopLevel[${index}] must be a top-level name`);
  });
  if (new Set(contract.home.reservedTopLevel.map(portablePathKey)).size !== contract.home.reservedTopLevel.length) {
    fail('home.reservedTopLevel must be unique without relying on filesystem case sensitivity');
  }
  assertPlainObject(contract.director, 'director');
  validateRelativePath(contract.director.source, 'director.source');
  validateRelativePath(contract.director.entry, 'director.entry');
  if (!Array.isArray(contract.director.rootAssetPrefixes) || !contract.director.rootAssetPrefixes.length) {
    fail('director.rootAssetPrefixes must declare shared root assets');
  }
  for (const [index, prefix] of contract.director.rootAssetPrefixes.entries()) {
    if (typeof prefix !== 'string' || !prefix.endsWith('/')) fail(`director.rootAssetPrefixes[${index}] must end with /`);
    validateRelativePath(prefix.slice(0, -1), `director.rootAssetPrefixes[${index}]`);
  }
  if (!Array.isArray(contract.requiredFiles) || !contract.requiredFiles.length) fail('requiredFiles must not be empty');
  const fixedOutputs = [contract.home.entry, contract.director.entry, contract.manifest, contract.deployedContract];
  if (new Set(fixedOutputs.map(portablePathKey)).size !== fixedOutputs.length) {
    fail('Home, director, contract, and manifest outputs must be portable and case-insensitively unique');
  }
  const outputs = new Set(fixedOutputs);
  for (const [index, mapping] of contract.requiredFiles.entries()) {
    assertPlainObject(mapping, `requiredFiles[${index}]`);
    validateRelativePath(mapping.source, `requiredFiles[${index}].source`);
    validateRelativePath(mapping.output, `requiredFiles[${index}].output`);
    if ([...outputs].some(output => portablePathKey(output) === portablePathKey(mapping.output))) {
      fail(`Duplicate output path: ${mapping.output}`);
    }
    outputs.add(mapping.output);
  }
  const protectedTopLevels = new Set([
    contract.director.entry,
    contract.manifest,
    contract.deployedContract,
    ...contract.requiredFiles.map(mapping => mapping.output)
  ].map(output => portablePathKey(output.split('/')[0])));
  const reservedTopLevels = new Set(contract.home.reservedTopLevel.map(portablePathKey));
  for (const protectedTopLevel of protectedTopLevels) {
    if (!reservedTopLevels.has(protectedTopLevel)) fail(`home.reservedTopLevel does not protect ${protectedTopLevel}`);
  }
  if (!Array.isArray(contract.routes) || contract.routes.length !== 2) fail('routes must define exactly home and director');
  const routes = new Map();
  for (const [index, route] of contract.routes.entries()) {
    assertPlainObject(route, `routes[${index}]`);
    if (typeof route.path !== 'string' || !route.path.startsWith('/') || !route.path.endsWith('/')) {
      fail(`routes[${index}].path must be a root-relative directory route`);
    }
    validateRelativePath(route.entry, `routes[${index}].entry`);
    if (route.fallback !== undefined) validateRelativePath(route.fallback, `routes[${index}].fallback`);
    if (routes.has(route.path)) fail(`Duplicate route path: ${route.path}`);
    routes.set(route.path, route);
  }
  if (routes.get('/')?.entry !== contract.home.entry || routes.get('/director/')?.entry !== contract.director.entry) {
    fail('routes must map / to home.entry and /director/ to director.entry');
  }
  for (const key of ['securityHeaders', 'cacheControl', 'mimeTypes']) assertPlainObject(contract[key], key);
  if (!contract.securityHeaders['Content-Security-Policy']?.includes("base-uri 'none'")) {
    fail("Content-Security-Policy must forbid document base changes with base-uri 'none'");
  }
  if (contract.securityHeaders['Content-Security-Policy'].includes('unsafe-eval')) {
    fail('Content-Security-Policy must not allow unsafe-eval');
  }
  return contract;
}

export async function readRuntimeContract({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  contractPath = DEFAULT_CONTRACT_PATH
} = {}) {
  const root = await assertRootDirectory(repositoryRoot, 'repositoryRoot');
  const inspected = await inspectPath(root, contractPath, 'file', 'contractPath');
  let contract;
  try {
    contract = JSON.parse(await fsp.readFile(inspected.absolute, 'utf8'));
  } catch (error) {
    fail(`Invalid Web runtime contract JSON: ${error.message}`);
  }
  return { root, contractPath: validateRelativePath(contractPath, 'contractPath'), contract: validateContract(contract) };
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rootDirectorAssets(html, prefixes, allowedRootReferences) {
  if (/<base\b/i.test(html)) fail('Director document must not define a base element');
  let transformed = html;
  for (const prefix of prefixes) {
    const expression = new RegExp(`\\b(src|href|poster)(\\s*=\\s*)(["'])${escapeRegularExpression(prefix)}`, 'gi');
    transformed = transformed.replace(expression, (_match, attribute, separator, quote) => {
      return `${attribute}${separator}${quote}/${prefix}`;
    });
  }
  const references = [...transformed.matchAll(/\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gi)].map(match => match[2]);
  for (const reference of references) {
    if (!reference || reference.startsWith('#') || /^(?:data|blob):/i.test(reference)) continue;
    if (reference.startsWith('//')) fail(`Director document contains a remote asset reference: ${reference}`);
    if (!reference.startsWith('/')) fail(`Director document contains an unrooted asset reference: ${reference}`);
    const publicPath = reference.split(/[?#]/, 1)[0];
    if (!allowedRootReferences.has(publicPath)) fail(`Director document references an undeclared asset: ${reference}`);
  }
  return transformed;
}

function validateHomeEntryName(name, relativePath) {
  if (name.startsWith('.') || /[\u0000-\u001f\u007f?#%\\]/.test(name)) {
    fail(`home.sourceDirectory contains an unsafe URL path: ${relativePath}`);
  }
}

async function collectDirectoryFiles(root, directoryRelativePath, mimeTypes) {
  const directory = await inspectPath(root, directoryRelativePath, 'directory', 'home.sourceDirectory', true);
  if (!directory) return null;
  const files = [];
  const portableOutputs = new Set();
  async function visit(absoluteDirectory, relativeDirectory) {
    const entries = await fsp.readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));
    const portableEntryNames = new Set();
    for (const entry of entries) {
      const sourceRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const portableEntryName = portablePathKey(entry.name);
      if (portableEntryNames.has(portableEntryName)) {
        fail(`home.sourceDirectory contains names that collide on a portable filesystem: ${sourceRelative}`);
      }
      portableEntryNames.add(portableEntryName);
      validateHomeEntryName(entry.name, sourceRelative);
      const sourceAbsolute = path.join(absoluteDirectory, entry.name);
      const stat = await fsp.lstat(sourceAbsolute);
      if (stat.isSymbolicLink()) fail(`home.sourceDirectory must not contain symbolic links: ${sourceRelative}`);
      if (stat.isDirectory()) await visit(sourceAbsolute, sourceRelative);
      else if (stat.isFile()) {
        const extension = path.posix.extname(sourceRelative).toLowerCase();
        if (!extension || !mimeTypes[extension]) fail(`Home file type is not declared in mimeTypes: ${sourceRelative}`);
        const output = validateRelativePath(sourceRelative, 'home output');
        const portableOutput = portablePathKey(output);
        if (portableOutputs.has(portableOutput)) fail(`Home outputs collide without case sensitivity: ${output}`);
        portableOutputs.add(portableOutput);
        files.push({ sourceAbsolute, output });
      }
      else fail(`home.sourceDirectory contains an unsupported filesystem entry: ${sourceRelative}`);
    }
  }
  await visit(directory.absolute, '');
  return files;
}

function collectHomeDependencyReferences(contents, extension) {
  const references = new Set();
  if (extension === '.html') {
    for (const match of contents.matchAll(/\b(?:src|poster)\s*=\s*(["'])(.*?)\1/gi)) references.add(match[2]);
    for (const match of contents.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) {
      if (/^(?:data|blob):/i.test(match[2].trim())) continue;
      for (const candidate of match[2].split(',')) {
        const reference = candidate.trim().split(/\s+/, 1)[0];
        if (reference) references.add(reference);
      }
    }
    for (const match of contents.matchAll(/<link\b[^>]*>/gi)) {
      const tag = match[0];
      const relation = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
      if (!/(?:^|\s)(?:stylesheet|icon|apple-touch-icon|mask-icon|manifest|preload|modulepreload)(?:\s|$)/i.test(relation)) continue;
      const reference = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (reference) references.add(reference);
    }
  }
  if (extension === '.html' || extension === '.css') {
    for (const match of contents.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^'"\s)][^)]*?))\s*\)/gi)) {
      const reference = (match[2] || match[3] || '').trim();
      if (reference) references.add(reference);
    }
    for (const match of contents.matchAll(/@import\s+(["'])(.*?)\1/gi)) references.add(match[2]);
  }
  return references;
}

function resolveHomeDependency(reference, sourceOutput, allowedOutputs, allowedRoutes) {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.startsWith('#') || /^(?:data|blob):/i.test(trimmed)) return;
  if (trimmed.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) {
    fail(`Home file contains a remote dependency: ${sourceOutput} -> ${trimmed}`);
  }
  const rawPath = trimmed.split(/[?#]/, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    fail(`Home file contains a malformed dependency URL: ${sourceOutput} -> ${trimmed}`);
  }
  if (decodedPath.startsWith('/') && allowedRoutes.has(decodedPath)) return;
  const output = decodedPath.startsWith('/')
    ? decodedPath.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(sourceOutput), decodedPath));
  validateRelativePath(output, `home dependency from ${sourceOutput}`);
  if (!allowedOutputs.has(output)) fail(`Home file references a missing dependency: ${sourceOutput} -> ${trimmed}`);
}

async function validateHomeDependencies(homeFiles, contract) {
  if (!homeFiles) return;
  const allowedOutputs = new Set([
    ...homeFiles.map(file => file.output),
    ...contract.requiredFiles.map(mapping => mapping.output),
    contract.director.entry,
    contract.deployedContract,
    contract.manifest
  ]);
  const allowedRoutes = new Set(contract.routes.map(route => route.path));
  for (const file of homeFiles) {
    const extension = path.posix.extname(file.output).toLowerCase();
    if (!['.html', '.css'].includes(extension)) continue;
    const contents = await fsp.readFile(file.sourceAbsolute, 'utf8');
    for (const reference of collectHomeDependencyReferences(contents, extension)) {
      resolveHomeDependency(reference, file.output, allowedOutputs, allowedRoutes);
    }
  }
}

async function writeFileWithParents(targetRoot, relativePath, contents) {
  const absolute = resolveInside(targetRoot, relativePath, 'output path');
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  await fsp.writeFile(absolute, contents);
}

async function sha256File(absolutePath) {
  const hash = crypto.createHash('sha256');
  const handle = await fsp.open(absolutePath, 'r');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest('hex');
}

async function createFileManifest(outputRoot, excludedPath) {
  const files = [];
  async function visit(absoluteDirectory, relativeDirectory) {
    const entries = await fsp.readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (relativePath === excludedPath) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const stat = await fsp.lstat(absolutePath);
      if (stat.isSymbolicLink()) fail(`Build output contains a symbolic link: ${relativePath}`);
      if (stat.isDirectory()) await visit(absolutePath, relativePath);
      else if (stat.isFile()) files.push({ path: relativePath, size: stat.size, sha256: await sha256File(absolutePath) });
      else fail(`Build output contains an unsupported filesystem entry: ${relativePath}`);
    }
  }
  await visit(outputRoot, '');
  return files.sort((a, b) => compareText(a.path, b.path));
}

async function replaceDirectory(staging, output) {
  const outputStat = await fsp.lstat(output).catch(error => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (outputStat?.isSymbolicLink()) fail('outputDirectory must not be a symbolic link');
  if (outputStat && !outputStat.isDirectory()) fail('outputDirectory must be a directory when it already exists');
  if (!outputStat) {
    await fsp.rename(staging, output);
    return null;
  }
  const backup = `${output}.previous-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  await fsp.rename(output, backup);
  try {
    await fsp.rename(staging, output);
  } catch (error) {
    await fsp.rename(backup, output).catch(() => {});
    throw error;
  }
  try {
    await fsp.rm(backup, { recursive: true, force: true });
    return null;
  } catch {
    return 'Previous Web output could not be removed; the new output is installed and the backup remains under dist/.';
  }
}

async function assertOutputPathSafe(root, outputRelative) {
  const segments = validateRelativePath(outputRelative, 'outputDirectory').split('/');
  let cursor = root;
  for (const segment of segments.slice(0, -1)) {
    cursor = path.join(cursor, segment);
    const stat = await fsp.lstat(cursor).catch(error => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (!stat) break;
    if (stat.isSymbolicLink()) fail(`outputDirectory must not pass through a symbolic link: ${outputRelative}`);
    if (!stat.isDirectory()) fail(`outputDirectory parent must be a directory: ${outputRelative}`);
  }
}

export async function buildWeb({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  contractPath = DEFAULT_CONTRACT_PATH,
  outputDirectory
} = {}) {
  const loaded = await readRuntimeContract({ repositoryRoot, contractPath });
  const { root, contract } = loaded;
  const outputRelative = validateRelativePath(outputDirectory || contract.outputDirectory, 'outputDirectory');
  if (!outputRelative.startsWith('dist/')) fail('outputDirectory must be a child of dist/');
  const output = resolveInside(root, outputRelative, 'outputDirectory');
  const outputParent = path.dirname(output);
  const outputParentRelation = path.relative(root, outputParent);
  if (outputParentRelation.startsWith('..') || path.isAbsolute(outputParentRelation)) fail('outputDirectory parent escapes repositoryRoot');
  await assertOutputPathSafe(root, outputRelative);

  const director = await inspectPath(root, contract.director.source, 'file', 'director.source');
  const required = [];
  for (const mapping of contract.requiredFiles) {
    required.push({ mapping, inspected: await inspectPath(root, mapping.source, 'file', 'required source') });
  }
  const homeFiles = await collectDirectoryFiles(root, contract.home.sourceDirectory, contract.mimeTypes);
  await validateHomeDependencies(homeFiles, contract);
  let homeMode = 'director-fallback';
  if (homeFiles) {
    const homeOutputs = new Set(homeFiles.map(file => file.output));
    if (!homeOutputs.has(contract.home.entry)) fail(`Home source exists but is missing ${contract.home.entry}`);
    const reservedTopLevels = new Set(contract.home.reservedTopLevel.map(portablePathKey));
    for (const file of homeFiles) {
      const topLevel = portablePathKey(file.output.split('/')[0]);
      if (reservedTopLevels.has(topLevel)) {
        fail(`Home output collides with reserved path: ${file.output}`);
      }
    }
    homeMode = 'provided-home';
  }

  await fsp.mkdir(outputParent, { recursive: true });
  await assertOutputPathSafe(root, outputRelative);
  const realRoot = await fsp.realpath(root);
  const realOutputParent = await fsp.realpath(outputParent);
  if (!isInside(realRoot, realOutputParent)) fail('outputDirectory parent resolves outside repositoryRoot');
  const staging = await fsp.mkdtemp(path.join(outputParent, `.${path.basename(output)}-staging-`));
  let committed = false;
  try {
    const allowedDirectorReferences = new Set([
      ...contract.routes.map(route => route.path),
      ...contract.requiredFiles.map(mapping => `/${mapping.output}`)
    ]);
    const directorHtml = rootDirectorAssets(
      await fsp.readFile(director.absolute, 'utf8'),
      contract.director.rootAssetPrefixes,
      allowedDirectorReferences
    );
    await writeFileWithParents(staging, contract.director.entry, directorHtml);
    for (const { mapping, inspected } of required) {
      await writeFileWithParents(staging, mapping.output, await fsp.readFile(inspected.absolute));
    }
    if (homeFiles) {
      for (const file of homeFiles) await writeFileWithParents(staging, file.output, await fsp.readFile(file.sourceAbsolute));
    } else {
      await writeFileWithParents(staging, contract.home.entry, directorHtml);
    }

    const contractBytes = await fsp.readFile(resolveInside(root, loaded.contractPath, 'contractPath'));
    await writeFileWithParents(staging, contract.deployedContract, contractBytes);
    const files = await createFileManifest(staging, contract.manifest);
    const contractSha256 = crypto.createHash('sha256').update(contractBytes).digest('hex');
    const manifest = {
      schemaVersion: 1,
      product: contract.product,
      mode: contract.mode,
      homeMode,
      manifest: contract.manifest,
      contract: contract.deployedContract,
      contractSha256,
      routes: contract.routes,
      securityHeaders: contract.securityHeaders,
      cacheControl: contract.cacheControl,
      mimeTypes: contract.mimeTypes,
      files
    };
    await writeFileWithParents(staging, contract.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    const cleanupWarning = await replaceDirectory(staging, output);
    committed = true;
    return { outputDirectory: output, outputRelative, manifest, homeMode, cleanupWarning };
  } finally {
    if (!committed) await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

function validateRequestTarget(requestTarget) {
  if (typeof requestTarget !== 'string' || !requestTarget.startsWith('/') || requestTarget.startsWith('//')) {
    fail('Invalid request target');
  }
  const rawPath = requestTarget.split('?', 1)[0];
  if (rawPath.includes('\\') || rawPath.includes('\0') || rawPath.includes('#')) fail('Invalid request path');
  if (/%(?:2f|5c|00)/i.test(rawPath)) fail('Encoded path separators are forbidden');
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    fail('Malformed request path encoding');
  }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('?') || decoded.includes('#') || decoded.startsWith('//')) {
    fail('Invalid request path');
  }
  if (decoded !== '/' && decoded.includes('//')) fail('Empty request path segments are forbidden');
  const segments = decoded.split('/');
  if (segments.some(segment => segment === '.' || segment === '..')) fail('Request path traversal is forbidden');
  if (/%(?:2e|2f|5c|00)/i.test(decoded)) fail('Nested request path encoding is forbidden');
  return decoded;
}

function safeRequestQuery(requestTarget) {
  const queryIndex = requestTarget.indexOf('?');
  if (queryIndex < 0) return '';
  const query = requestTarget.slice(queryIndex);
  if (/[\u0000-\u001f\u007f#\\]/.test(query)) fail('Invalid request query');
  return query;
}

function isInside(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation && !relation.startsWith('..') && !path.isAbsolute(relation);
}

async function readContainedRegularFile(root, relativePath) {
  validateRelativePath(relativePath, 'manifest file path');
  const absolute = resolveInside(root, relativePath, 'manifest file path');
  let cursor = root;
  const segments = relativePath.split('/');
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    const stat = await fsp.lstat(cursor).catch(() => null);
    if (!stat || stat.isSymbolicLink()) fail(`Deployment file is missing or unsafe: ${relativePath}`);
    const finalSegment = index === segments.length - 1;
    if (!finalSegment && !stat.isDirectory()) fail(`Deployment path has a non-directory parent: ${relativePath}`);
    if (finalSegment && !stat.isFile()) fail(`Deployment entry is not a regular file: ${relativePath}`);
  }
  const handle = await fsp.open(
    absolute,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0) | (fsConstants.O_NONBLOCK || 0)
  ).catch(() => null);
  if (!handle) fail(`Deployment entry cannot be opened safely: ${relativePath}`);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail(`Deployment entry is not a regular file: ${relativePath}`);
    const real = await fsp.realpath(absolute);
    const realRoot = await fsp.realpath(root);
    if (!isInside(realRoot, real)) fail(`Deployment file escapes root: ${relativePath}`);
    const bytes = await handle.readFile();
    return { absolute, stat, bytes };
  } finally {
    await handle.close().catch(() => {});
  }
}

async function readVerifiedDeploymentFile(root, relativePath, expected) {
  const opened = await readContainedRegularFile(root, relativePath);
  const { stat, bytes } = opened;
  if (!Number.isSafeInteger(expected.size) || expected.size < 0 || stat.size !== expected.size) {
    fail(`Deployment file size does not match manifest: ${relativePath}`);
  }
  if (!/^[a-f0-9]{64}$/.test(expected.sha256) || crypto.createHash('sha256').update(bytes).digest('hex') !== expected.sha256) {
    fail(`Deployment file hash does not match manifest: ${relativePath}`);
  }
  return opened;
}

export async function loadDeployment(rootDirectory) {
  const root = await assertRootDirectory(rootDirectory, 'preview root');
  const manifestRelativePath = DEPLOYMENT_MANIFEST_PATH;
  const manifestFile = await readContainedRegularFile(root, manifestRelativePath).catch(() => null);
  if (!manifestFile) fail('Preview root is missing a safe prevision-web-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestFile.bytes.toString('utf8'));
  } catch (error) {
    fail(`Invalid deployment manifest JSON: ${error.message}`);
  }
  assertPlainObject(manifest, 'deployment manifest');
  if (manifest.schemaVersion !== 1 || manifest.mode !== 'static-web-runtime') fail('Unsupported deployment manifest');
  if (manifest.manifest !== manifestRelativePath) fail('Deployment manifest has an unexpected public path');
  for (const key of ['securityHeaders', 'cacheControl', 'mimeTypes']) assertPlainObject(manifest[key], `manifest.${key}`);
  if (!Array.isArray(manifest.routes) || !Array.isArray(manifest.files) || !manifest.files.length) {
    fail('Deployment manifest is missing routes or files');
  }
  const files = new Map();
  const portableManifestPaths = new Set();
  let prior = null;
  for (const item of manifest.files) {
    assertPlainObject(item, 'manifest file');
    validateRelativePath(item.path, 'manifest file path');
    if (prior !== null && compareText(prior, item.path) >= 0) fail('Deployment manifest file paths must be sorted and unique');
    const portableManifestPath = portablePathKey(item.path);
    if (portableManifestPaths.has(portableManifestPath)) {
      fail('Deployment manifest file paths must not collide on a case-insensitive filesystem');
    }
    portableManifestPaths.add(portableManifestPath);
    prior = item.path;
    const opened = await readVerifiedDeploymentFile(root, item.path, item);
    files.set(item.path, { ...item, absolute: opened.absolute });
  }
  files.set(manifestRelativePath, {
    path: manifestRelativePath,
    size: manifestFile.stat.size,
    sha256: crypto.createHash('sha256').update(manifestFile.bytes).digest('hex'),
    absolute: manifestFile.absolute
  });
  const contractFile = files.get(manifest.contract);
  if (!contractFile || contractFile.sha256 !== manifest.contractSha256) fail('Deployment contract does not match manifest');
  let deployedContract;
  try {
    const opened = await readVerifiedDeploymentFile(root, manifest.contract, contractFile);
    deployedContract = validateContract(JSON.parse(opened.bytes.toString('utf8')));
  } catch (error) {
    fail(`Invalid deployed Web runtime contract: ${error.message}`);
  }
  const manifestContractPairs = [
    ['product', manifest.product, deployedContract.product],
    ['mode', manifest.mode, deployedContract.mode],
    ['manifest', manifest.manifest, deployedContract.manifest],
    ['contract', manifest.contract, deployedContract.deployedContract],
    ['routes', manifest.routes, deployedContract.routes],
    ['securityHeaders', manifest.securityHeaders, deployedContract.securityHeaders],
    ['cacheControl', manifest.cacheControl, deployedContract.cacheControl],
    ['mimeTypes', manifest.mimeTypes, deployedContract.mimeTypes]
  ];
  for (const [label, actual, expected] of manifestContractPairs) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`Deployment manifest ${label} does not match deployed contract`);
  }
  if (!['director-fallback', 'provided-home'].includes(manifest.homeMode)) fail('Deployment manifest has an invalid homeMode');
  const requiredDeploymentOutputs = [
    deployedContract.home.entry,
    deployedContract.director.entry,
    deployedContract.deployedContract,
    ...deployedContract.requiredFiles.map(mapping => mapping.output)
  ];
  for (const requiredOutput of requiredDeploymentOutputs) {
    if (!files.has(requiredOutput)) fail(`Deployment is missing a contract-required file: ${requiredOutput}`);
  }
  const routes = new Map();
  for (const route of manifest.routes) {
    if (typeof route.path !== 'string' || !route.path.startsWith('/') || !route.path.endsWith('/')) fail('Invalid deployment route');
    validateRelativePath(route.entry, 'route entry');
    if (route.fallback !== undefined) validateRelativePath(route.fallback, 'route fallback');
    if (!files.has(route.entry) || (route.fallback && !files.has(route.fallback))) {
      fail(`Route target is missing from deployment: ${route.path}`);
    }
    routes.set(route.path, route);
  }
  if (!routes.has('/') || !routes.has('/director/')) fail('Deployment must contain / and /director/ routes');
  return { root, manifest, files, routes };
}

function parseHostHeader(hostHeader, expectedPort, allowedHosts = null) {
  if (typeof hostHeader !== 'string') fail('Invalid Host header');
  const match = allowedHosts
    ? hostHeader.match(/^([A-Za-z0-9.-]+):(\d{1,5})$/)
    : hostHeader.match(/^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/i);
  if (!match) {
    fail(allowedHosts
      ? 'Host must be an explicit allowed host and port'
      : 'Host must be an explicit loopback host and port');
  }
  const port = Number(match[2]);
  if (port !== expectedPort) fail('Host port does not match preview listener');
  if (allowedHosts) {
    if (!Array.isArray(allowedHosts) || !allowedHosts.length) fail('allowedHosts must be a non-empty array');
    const normalizedAllowedHosts = new Set(allowedHosts.map(value => {
      if (typeof value !== 'string' || !/^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)$/.test(value)) {
        fail('allowedHosts contains an invalid host');
      }
      return value.toLowerCase();
    }));
    if (!normalizedAllowedHosts.has(match[1].toLowerCase())) fail('Host is not allowed');
  }
}

function sendResponse(response, method, statusCode, headers, body = '') {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(statusCode, { ...headers, 'Content-Length': String(buffer.length) });
  if (method === 'HEAD') response.end();
  else response.end(buffer);
}

function commonHeaders(manifest, extra = {}) {
  return { ...manifest.securityHeaders, ...extra };
}

function contentTypeFor(manifest, relativePath) {
  return manifest.mimeTypes[path.posix.extname(relativePath).toLowerCase()] || 'application/octet-stream';
}

function isHtmlNavigation(request, pathname) {
  const lastSegment = pathname.split('/').filter(Boolean).at(-1) || '';
  const accept = String(request.headers.accept || '');
  return !lastSegment.includes('.') && /(?:^|,)\s*text\/html(?:\s*;|\s*,|$)/i.test(accept);
}

function resolveRequestFile(deployment, request, pathname) {
  if (pathname === '/') return deployment.routes.get('/').entry;
  if (pathname === '/director/') return deployment.routes.get('/director/').entry;
  const exact = pathname.slice(1);
  if (exact && deployment.files.has(exact)) return exact;
  if (!isHtmlNavigation(request, pathname)) return null;
  if (pathname.startsWith('/director/')) return deployment.routes.get('/director/').fallback;
  return null;
}

export function createRequestHandler(deployment, server, {
  allowedHosts = null,
  deploymentFailureStatus = 500,
  onDeploymentFailure = null
} = {}) {
  return async (request, response) => {
    const method = request.method || 'GET';
    const errorHeaders = commonHeaders(deployment.manifest, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': deployment.manifest.cacheControl.error
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') fail('Preview listener is unavailable');
      try {
        parseHostHeader(request.headers.host, address.port, allowedHosts);
      } catch {
        sendResponse(response, method, 421, errorHeaders, 'Misdirected Request\n');
        return;
      }
      if (!['GET', 'HEAD'].includes(method)) {
        sendResponse(response, method, 405, { ...errorHeaders, Allow: 'GET, HEAD' }, 'Method Not Allowed\n');
        return;
      }
      let pathname;
      try {
        pathname = validateRequestTarget(request.url || '');
      } catch {
        sendResponse(response, method, 400, errorHeaders, 'Bad Request\n');
        return;
      }
      if (pathname === '/director') {
        let query;
        try {
          query = safeRequestQuery(request.url || '');
        } catch {
          sendResponse(response, method, 400, errorHeaders, 'Bad Request\n');
          return;
        }
        sendResponse(response, method, 308, commonHeaders(deployment.manifest, {
          Location: `/director/${query}`,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': deployment.manifest.cacheControl.error
        }), 'Permanent Redirect\n');
        return;
      }
      const relativePath = resolveRequestFile(deployment, request, pathname);
      if (!relativePath) {
        sendResponse(response, method, 404, errorHeaders, 'Not Found\n');
        return;
      }
      const file = deployment.files.get(relativePath);
      const { bytes } = await readVerifiedDeploymentFile(deployment.root, relativePath, file);
      const cacheKey = relativePath === 'prevision-web-manifest.json'
        ? 'manifest'
        : path.posix.extname(relativePath).toLowerCase() === '.html' ? 'html' : 'asset';
      sendResponse(response, method, 200, commonHeaders(deployment.manifest, {
        'Content-Type': contentTypeFor(deployment.manifest, relativePath),
        'Cache-Control': deployment.manifest.cacheControl[cacheKey],
        ETag: `"${file.sha256}"`
      }), bytes);
    } catch (error) {
      if (onDeploymentFailure) {
        try {
          await onDeploymentFailure(error);
        } catch {
          // The response still fails closed if redacted state persistence also fails.
        }
      }
      const status = onDeploymentFailure ? deploymentFailureStatus : 500;
      if (!response.headersSent) {
        sendResponse(
          response,
          method,
          status,
          errorHeaders,
          status === 503 ? 'Preview Unavailable\n' : 'Internal Server Error\n'
        );
      }
      else response.destroy();
    }
  };
}

export async function startPreviewServer({
  rootDirectory = path.join(DEFAULT_REPOSITORY_ROOT, 'dist', 'web'),
  host = '127.0.0.1',
  port = 4173
} = {}) {
  if (host !== '127.0.0.1') fail('Preview host must be exactly 127.0.0.1');
  const numericPort = typeof port === 'string' && /^\d+$/.test(port) ? Number(port) : port;
  if (!Number.isInteger(numericPort) || numericPort < 0 || numericPort > 65535) fail('Preview port must be an integer from 0 to 65535');
  const deployment = await loadDeployment(rootDirectory);
  let server;
  server = http.createServer((request, response) => {
    createRequestHandler(deployment, server)(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(numericPort, host);
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
    await new Promise(resolve => server.close(resolve));
    fail('Preview listener did not bind to the required loopback address');
  }
  return {
    server,
    deployment,
    host,
    port: address.port,
    origin: `http://${host}:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}
