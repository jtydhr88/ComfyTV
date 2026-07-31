import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, '..');
const REPO = path.resolve(SITE, '..');
const NODE_DOCS = path.join(REPO, 'node-docs');
const GUIDE_DOCS = path.join(REPO, 'docs');
const DOCS_JSON = path.join(SITE, 'docs.json');

const DRY = process.argv.includes('--dry-run');

const CATEGORY_GROUPS = [
  ['Project & Timeline', ['ProjectStage', 'DirectorTimelineStage', 'TimelineVideoStage', 'SequenceStage']],
  ['Input & Loaders', ['ImageLoaderStage', 'VideoLoaderStage', 'AudioLoaderStage', 'TextLoaderStage', 'ModelLoaderStage', 'AssetImageLoaderStage', 'AssetVideoLoaderStage', 'AssetAudioLoaderStage', 'AssetModelLoaderStage']],
  ['Generate', ['TextStage', 'ImageStage', 'VideoStage', 'AudioStage', 'SpeechStage', 'Model3DStage', 'ShotImagesStage', 'StoryboardStage']],
  ['Pick & Compare', ['ImagePickerStage', 'AudioPickerStage', 'VideoPickerStage', 'CompareStage', 'ContactSheetStage']],
  ['Image · Edit', ['ImageEditStage', 'InpaintStage', 'OutpaintStage', 'EraseStage', 'CutoutStage', 'UpscaleStage', 'RelightStage', 'ImageVariationsStage', 'MultiangleStage', 'SplitPartStage']],
  ['Image · Transform', ['CropStage', 'RotateStage', 'MirrorStage', 'GridSplitStage', 'ColorGradeStage']],
  ['2D Editors', ['LayerEditorStage', 'StoryboardEditorStage']],
  ['Panorama', ['PanoramaStage', 'PanoramaCurrentViewStage', 'PanoramaMultiViewStage']],
  ['3D', ['Scene3DStage', 'MaterialStage', 'MeshPrimitiveStage', 'MeshOpStage', 'MeshBooleanStage', 'MeshBakeMapsStage', 'LineArtStage']],
  ['Video · Edit', ['VideoClipStage', 'VideoCropStage', 'VideoResizeStage', 'VideoConcatStage', 'VideoSpeedStage', 'VideoRotateStage', 'VideoSplitStage', 'VideoVolumeStage', 'VideoMuxAudioStage', 'VideoExtractFrameStage', 'VideoFramesStage', 'VideoUpscaleStage', 'MakeProxyStage']],
  ['Video · Color', ['VideoColorStage', 'VideoCurvesStage', 'VideoLUTStage', 'HueCorrectStage', 'SelectiveColorStage', 'GrayWorldStage', 'CDLStage', 'HistogramEqStage']],
  ['Video · Keying & Matte', ['VideoChromaKeyStage', 'PIKStage', 'KeyerStage', 'DespillStage', 'ColorSuppressStage', 'KeyMixStage', 'MatteMonitorStage', 'MatteMorphStage', 'Select0rStage', 'RotoMaskStage', 'ShapeMaskStage', 'MaskPropagateStage', 'MotionTrackStage', 'MaskCleanup']],
  ['Video · Compositing', ['VideoCompositeStage', 'VideoTransformStage', 'CornerPinStage', 'STMapStage', 'Card3DStage']],
  ['Video · Enhance & Restore', ['VideoBlurSharpenStage', 'VideoDenoiseStage', 'VideoInterpolateStage', 'VideoDeinterlaceStage', 'VideoStabilizeStage', 'VideoStabilizeV2Stage', 'FaceBlurStage', 'SpotRemoverStage']],
  ['Video · Optics & Lens', ['Video360Stage', 'Video360StabilizeStage', 'LensDistortStage', 'ChromaticAberrationStage', 'LensFlareStage', 'ZDefocusStage', 'STMapGenStage']],
  ['Video · Stylize', ['VideoStylizeStage', 'GlowStage', 'GodRaysStage', 'OldFilmStage', 'FrameBlendStage', 'ChromaShiftStage', 'PseudocolorStage', 'PosterizeStage', 'RegrainStage']],
  ['Video · Art & Time FX', ['ArtFXStage', 'GlitchFXStage', 'KaleidoscopeStage', 'WaveWarpStage', 'WaterStage', 'LightGraffitiStage', 'SlitScanStage', 'FeedbackFXStage', 'StrobeStage', 'ParticlesStage', 'PatternStage']],
  ['Video · Transitions', ['VideoTransitionStage', 'VideoLumaWipeStage', 'TimeRemapStage', 'KenBurnsStage']],
  ['Video · Text & Annotate', ['TitleStage', 'SubtitleStage', 'SubtitleGenStage', 'VideoSubtitleSmartEraseStage', 'VideoSubtitleSelectEraseStage', 'AnnotateStage', 'PaintStrokeStage']],
  ['Video · Analysis & Chain', ['SceneDetectStage', 'VideoScopesStage', 'FXChainStage', 'ExpressionStage']],
  ['Audio · Edit & Mix', ['AudioExtractVocalStage', 'AudioExtractBgStage', 'AudioCrossfadeStage', 'AudioMixStage', 'AudioDuckStage', 'AudioSegmentExportStage', 'AudioVideoDemuxAudioStage', 'AudioVideoDemuxVideoStage']],
  ['Audio · Process & FX', ['AudioDynamicsStage', 'AudioEQStage', 'AudioLoudnessStage', 'AudioDenoiseStage', 'AudioRepairStage', 'AudioEchoStage', 'AudioModulationStage', 'AudioStereoStage', 'AudioTimePitchStage', 'AudioSaturateStage', 'AudioConvolveStage', 'MuseReverbStage']],
  ['Audio · Analyze & React', ['AudioAnalyzeStage', 'AudioVisualizeStage', 'AudioSweepStage', 'AudioDeconvolveStage', 'AudioMIRStage', 'AudioNoiseReductionStage', 'AudioStemSplitStage', 'AudioReactiveStage', 'AudioMeterStage']],
  ['Music (Symbolic)', ['ScoreStage', 'ScoreEditorStage', 'MidiEditorStage', 'ScoreToMidiStage', 'SF2SynthStage', 'ClickTrackStage', 'ChordAccompStage']],
  ['Bridges', ['BridgeFromImage', 'BridgeToImage', 'BridgeToImages', 'BridgeFromVideo', 'BridgeToVideo', 'BridgeFromAudio', 'BridgeToAudio', 'BridgeFromText', 'BridgeToText', 'BridgeFromMask']],
];

const slug = (nodeId) => nodeId.replace(/Stage$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }

function esc(s) { return String(s).replace(/"/g, '\\"'); }

function parseDoc(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title = '', desc = '', i = 0;
  while (i < lines.length && !lines[i].startsWith('# ')) i++;
  if (i < lines.length) { title = lines[i].replace(/^#\s+/, '').trim(); i++; }
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].startsWith('>')) {
    const dl = [];
    while (i < lines.length && lines[i].startsWith('>')) { dl.push(lines[i].replace(/^>\s?/, '')); i++; }
    desc = dl.join(' ').trim();
  }
  const body = lines.slice(i).join('\n').trim();
  return { title, desc, body };
}

function sanitizeMdx(md) {
  return md.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((seg, i) => {
    if (i % 2 === 1) return seg;
    return seg
      .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
      .replace(/</g, '&lt;')
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;');
  }).join('');
}

function frontmatter(fields) {
  const out = ['---'];
  for (const [k, v] of Object.entries(fields)) if (v != null && v !== '') out.push(`${k}: "${esc(v)}"`);
  out.push('---');
  return out.join('\n');
}

let written = 0, skipped = 0;
function writeFile(rel, content) {
  const abs = path.join(SITE, rel);
  if (DRY) { console.log('  would write', rel); return; }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  written++;
}

const documented = fs.existsSync(NODE_DOCS)
  ? fs.readdirSync(NODE_DOCS).filter((d) => d.startsWith('ComfyTV.')).map((d) => d.slice('ComfyTV.'.length))
  : [];
const inGroups = new Set(CATEGORY_GROUPS.flatMap(([, ids]) => ids));
const uncategorized = documented.filter((id) => !inGroups.has(id));
if (uncategorized.length) {
  console.warn('  [warn] documented but ungrouped nodes (append to CATEGORY_GROUPS):', uncategorized.join(', '));
  CATEGORY_GROUPS.push(['Uncategorized', uncategorized]);
}

function hero(nodeId, s, title, locale) {
  const real = fs.existsSync(path.join(SITE, 'images', 'nodes', `${s}.png`));
  if (!real && nodeId.startsWith('Bridge')) return '';
  const src = real ? `/images/nodes/${s}.png` : '/images/nodes/_placeholder.svg';
  const cap = real
    ? (locale === 'zh' ? `${title}（ComfyTV）` : `${title} in ComfyTV`)
    : (locale === 'zh' ? `${title} · 截图待补` : `${title} · screenshot coming soon`);
  return `<Frame caption="${esc(cap)}">\n  <img src="${src}" alt="${esc(title)}" />\n</Frame>\n\n`;
}

function emitNodePages(nodeId) {
  const dir = path.join(NODE_DOCS, `ComfyTV.${nodeId}`);
  const s = slug(nodeId);
  const enRaw = fs.existsSync(path.join(dir, 'en.md')) ? fs.readFileSync(path.join(dir, 'en.md'), 'utf8') : '';
  if (!enRaw) { skipped++; return null; }
  const en = parseDoc(enRaw);
  const enTitle = en.title || nodeId;
  writeFile(`node-reference/${s}.mdx`,
    frontmatter({ title: enTitle, description: en.desc, sidebarTitle: enTitle.replace(/\s*\(.*\)$/, '') }) + '\n\n' + hero(nodeId, s, enTitle, 'en') + sanitizeMdx(en.body) + '\n');

  const zhPath = path.join(dir, 'zh.md');
  if (fs.existsSync(zhPath)) {
    const zh = parseDoc(fs.readFileSync(zhPath, 'utf8'));
    writeFile(`zh/node-reference/${s}.mdx`,
      frontmatter({ title: zh.title || enTitle, description: zh.desc, sidebarTitle: (zh.title || '').replace(/\s*\(.*\)$/, ''), translationSourceHash: sha(enRaw) }) + '\n\n' + hero(nodeId, s, zh.title || enTitle, 'zh') + sanitizeMdx(zh.body) + '\n');
  }
  return s;
}

const enNodeGroups = [], zhNodeGroups = [];
for (const [label, ids] of CATEGORY_GROUPS) {
  const enPages = [], zhPages = [];
  for (const id of ids) {
    const s = emitNodePages(id);
    if (!s) continue;
    enPages.push(`node-reference/${s}`);
    if (fs.existsSync(path.join(SITE, `zh/node-reference/${s}.mdx`)) || DRY) zhPages.push(`zh/node-reference/${s}`);
  }
  if (enPages.length) enNodeGroups.push({ group: label, pages: enPages });
  if (zhPages.length) zhNodeGroups.push({ group: label, pages: zhPages });
}

const GUIDE_ORDER = ['getting-started', 'sidebar', 'generate', 'image-tools', 'panorama', 'video-and-audio', 'making-music', 'compose', 'models', 'bridges', 'custom-workflows', 'sidebar-config-editor'];

function cleanGuide(md, locale) {
  let text = md.replace(/\r\n/g, '\n');
  text = text.replace(/<!--[\s\S]*?-->[ \t]*\n?/g, '');
  text = text.replace(/^\*\*[^\n]*\|[^\n]*\n/, '').replace(/^\s+/, '');
  const { title, desc, body } = parseDoc(text);
  const base = locale === 'zh' ? '/zh/guides/' : '/guides/';
  let out = body
    .replace(/\]\(([a-z0-9-]+)\.zh\.md\)/g, (_m, n) => `](/zh/guides/${n})`)
    .replace(/\]\(([a-z0-9-]+)\.md\)/g, (_m, n) => `](${base}${n})`)
    .replace(/\]\(images\//g, '](/images/');
  return { title, desc, body: out };
}

function copyImages() {
  const src = path.join(GUIDE_DOCS, 'images');
  if (!fs.existsSync(src) || DRY) return;
  const dst = path.join(SITE, 'images');
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  const walk = (from, to) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const f = path.join(from, e.name), t = path.join(to, e.name);
      if (e.isDirectory()) { fs.mkdirSync(t, { recursive: true }); walk(f, t); }
      else { fs.copyFileSync(f, t); n++; }
    }
  };
  walk(src, dst);
  console.log(`  copied ${n} image(s) from docs/images`);
}
copyImages();

const enGuidePages = [], zhGuidePages = [];
for (const topic of GUIDE_ORDER) {
  const enPath = path.join(GUIDE_DOCS, `${topic}.md`);
  if (!fs.existsSync(enPath)) { console.warn('  [warn] missing guide', topic); continue; }
  const enRaw = fs.readFileSync(enPath, 'utf8');
  const g = cleanGuide(enRaw, 'en');
  writeFile(`guides/${topic}.mdx`, frontmatter({ title: g.title, description: g.desc }) + '\n\n' + sanitizeMdx(g.body) + '\n');
  enGuidePages.push(`guides/${topic}`);

  const zhPath = path.join(GUIDE_DOCS, `${topic}.zh.md`);
  if (fs.existsSync(zhPath)) {
    const zg = cleanGuide(fs.readFileSync(zhPath, 'utf8'), 'zh');
    writeFile(`zh/guides/${topic}.mdx`, frontmatter({ title: zg.title, description: zg.desc, translationSourceHash: sha(enRaw) }) + '\n\n' + sanitizeMdx(zg.body) + '\n');
    zhGuidePages.push(`zh/guides/${topic}`);
  }
}

const TAB_NAMES = {
  en: { guides: 'Guides', nodes: 'Node Reference' },
  zh: { guides: '指南', nodes: '节点参考' },
};

if (fs.existsSync(DOCS_JSON)) {
  const cfg = JSON.parse(fs.readFileSync(DOCS_JSON, 'utf8'));
  const setTab = (langCode, tabName, pages) => {
    const lang = cfg.navigation.languages.find((l) => l.language === langCode);
    if (!lang) return;
    const tab = lang.tabs.find((t) => t.tab === tabName);
    if (tab) tab.pages = pages;
  };
  setTab('en', TAB_NAMES.en.nodes, enNodeGroups);
  setTab('zh', TAB_NAMES.zh.nodes, zhNodeGroups);
  setTab('en', TAB_NAMES.en.guides, [{ group: 'Guides', pages: ['index', ...enGuidePages] }]);
  setTab('zh', TAB_NAMES.zh.guides, [{ group: '指南', pages: ['zh/index', ...zhGuidePages] }]);

  if (!DRY) fs.writeFileSync(DOCS_JSON, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

console.log(`\n${DRY ? '[dry-run] ' : ''}nodes documented: ${documented.length}  | pages written: ${written}  | skipped(no en.md): ${skipped}`);
console.log(`node groups: ${enNodeGroups.length}  | guide pages: ${enGuidePages.length}`);
