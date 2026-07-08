import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const defaultSourceRoot = path.resolve(repoRoot, '..', 'The Complete KayKit Collection v6');
const defaultDestRoot = path.resolve(repoRoot, 'lander', 'public', 'assets', 'kaykit');

const toPosix = (p) => p.split(path.sep).join('/');

const formatMs = (ms) => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

const log = (msg) => { process.stdout.write(`${msg}\n`); };

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const readUtf8 = (p) => fs.readFileSync(p, 'utf8');

const writeUtf8 = (p, text) => {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, text, 'utf8');
};

const readJson = (p) => JSON.parse(readUtf8(p));

const listDirs = (dir) => {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
};

const listFilesRecursive = (dir) => {
  const out = [];
  const stack = [dir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (!fs.existsSync(cur)) continue;

    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }

  return out;
};

const copyFileIfChanged = (src, dest) => {
  ensureDir(path.dirname(dest));

  const srcStat = fs.statSync(src);
  const destStat = fs.existsSync(dest) ? fs.statSync(dest) : null;
  if (destStat && destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) return false;

  fs.copyFileSync(src, dest);
  return true;
};

const readGlbJsonChunk = (filePath) => {
  const buf = fs.readFileSync(filePath);
  if (buf.byteLength < 20) throw new Error(`GLB too small: ${filePath}`);

  const magic = buf.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error(`Invalid GLB magic: ${filePath}`);

  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}: ${filePath}`);

  let off = 12;
  while (off + 8 <= buf.byteLength) {
    const chunkLength = buf.readUInt32LE(off);
    const chunkType = buf.readUInt32LE(off + 4);
    off += 8;

    const next = off + chunkLength;
    if (next > buf.byteLength) break;

    if (chunkType === 0x4e4f534a) {
      const jsonText = buf.toString('utf8', off, next);
      return JSON.parse(jsonText);
    }

    off = next;
  }

  throw new Error(`GLB missing JSON chunk: ${filePath}`);
};

const readGltfJson = (filePath) => readJson(filePath);

const classifyGltf = (gltf) => {
  const skinCount = Array.isArray(gltf.skins) ? gltf.skins.length : 0;
  const animCount = Array.isArray(gltf.animations) ? gltf.animations.length : 0;

  if (skinCount === 0 && animCount === 0) return { kind: 'StaticProp' };
  if (skinCount > 0 && animCount === 0) return { kind: 'CharacterModel' };
  if (animCount > 0) return { kind: 'AnimationSet' };
  return { kind: 'Unknown' };
};

const pickRigKind = (gltf) => {
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const names = nodes.map((n) => (n && typeof n.name === 'string' ? n.name : '')).filter(Boolean);

  const hasRigLarge = names.some((n) => n === 'Rig_Large' || n.includes('MannequinLarge_'));
  if (hasRigLarge) return 'Large';

  const hasRigMedium = names.some((n) => n === 'Rig_Medium' || (n.includes('Mannequin_') && !n.includes('MannequinLarge_')));
  if (hasRigMedium) return 'Medium';

  return null;
};

const getBoneNames = (gltf) => {
  const skins = Array.isArray(gltf.skins) ? gltf.skins : [];
  if (!skins.length) return [];

  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const joints = Array.isArray(skins[0].joints) ? skins[0].joints : [];

  const names = [];
  for (const idx of joints) {
    const n = nodes[idx];
    const nm = n && typeof n.name === 'string' ? n.name : null;
    if (nm) names.push(nm);
  }
  return names;
};

const getClipNames = (gltf) => {
  const anims = Array.isArray(gltf.animations) ? gltf.animations : [];
  return anims.map((a, i) => (a && typeof a.name === 'string' && a.name.length ? a.name : `Anim_${i}`));
};

const getImageRefs = (gltf) => {
  const images = Array.isArray(gltf.images) ? gltf.images : [];
  const refs = [];
  for (const img of images) {
    if (!img || typeof img !== 'object') continue;
    const name = typeof img.name === 'string' ? img.name : null;
    const uri = typeof img.uri === 'string' ? img.uri : null;
    refs.push({ name, uri });
  }
  return refs;
};

const getBufferUris = (gltf) => {
  const buffers = Array.isArray(gltf.buffers) ? gltf.buffers : [];
  const out = [];
  for (const b of buffers) {
    if (!b || typeof b !== 'object') continue;
    const uri = typeof b.uri === 'string' ? b.uri : null;
    if (uri) out.push(uri);
  }
  return out;
};

const getRelativeFromSourceRoot = (sourceRoot, absPath) => toPosix(path.relative(sourceRoot, absPath));

const isUnderAssetsGltfFolder = (relPosix) => relPosix.toLowerCase().includes('/assets/gltf/');

const isCharacterGlbHeuristic = (relPosix) => {
  const lower = relPosix.toLowerCase();
  return (lower.includes('/characters/') || lower.includes('/character/')) && lower.endsWith('.glb');
};

const isAnimationGlbHeuristic = (relPosix) => {
  const lower = relPosix.toLowerCase();
  return lower.includes('/animations/gltf/') && lower.endsWith('.glb');
};

const isPreviewableExt = (p) => {
  const lower = p.toLowerCase();
  return lower.endsWith('.gltf') || lower.endsWith('.glb');
};

const VARIANT_STEM_RE = /^(.*)(_alt_[a-z0-9]+|_alt\d*|alt_texture_\d+.*)$/i;

const stemFromTextureFile = (fileName) => {
  const base = path.basename(fileName, path.extname(fileName));
  const m = base.match(VARIANT_STEM_RE);
  if (m) return m[1].replace(/_+$/, '');
  return base;
};

const labelFromTextureFile = (fileName, isDefault) => {
  if (isDefault) return 'Default';
  const base = path.basename(fileName, path.extname(fileName));
  const m = base.match(VARIANT_STEM_RE);
  if (!m) return base;
  const suffix = m[2].replace(/^_?/, '');
  return suffix
    .replace(/alt_texture_/i, 'Alt ')
    .replace(/^alt_/i, 'Alt ')
    .replace(/_/g, ' ');
};

const stemFromRef = (ref) => {
  if (!ref) return null;

  if (typeof ref.uri === 'string' && ref.uri.length) return stemFromTextureFile(ref.uri);
  if (typeof ref.name === 'string' && ref.name.length) return ref.name;
  return null;
};

const labelFromStemAndFile = (stem, fileName) => {
  const base = path.basename(fileName, path.extname(fileName));
  if (base.toLowerCase() === stem.toLowerCase()) return 'Default';

  const lower = base.toLowerCase();
  const lowerStem = stem.toLowerCase();
  if (lower.startsWith(`${lowerStem}_`)) {
    const suffix = base.slice(stem.length + 1);
    if (!suffix.length) return base;
    return suffix.replace(/_/g, ' ');
  }

  return labelFromTextureFile(fileName, false);
};

const getVariantPackDirRel = (relGltfPosix) => {
  const lower = relGltfPosix.toLowerCase();

  const assetsIdx = lower.indexOf('/assets/gltf/');
  if (assetsIdx >= 0) return relGltfPosix.slice(0, assetsIdx);

  const charactersIdx = lower.indexOf('/characters/gltf/');
  if (charactersIdx >= 0) return relGltfPosix.slice(0, charactersIdx);

  const characterIdx = lower.indexOf('/character/gltf/');
  if (characterIdx >= 0) return relGltfPosix.slice(0, characterIdx);

  return toPosix(path.dirname(relGltfPosix));
};

const listTextureVariantsNear = (sourceRoot, destRoot, relGltfPosix, imageRefs) => {
  const gltfAbsDir = path.dirname(path.join(destRoot, relGltfPosix));
  const packRel = relGltfPosix.split('/').slice(0, 1)[0] ?? '';
  const packDirRel = getVariantPackDirRel(relGltfPosix);
  const candidateDirs = [
    gltfAbsDir,
    path.join(destRoot, packDirRel, 'textures'),
    path.join(destRoot, packDirRel, 'Textures'),
    path.join(sourceRoot, packDirRel, 'textures'),
    path.join(sourceRoot, packDirRel, 'Textures'),
    path.join(destRoot, packRel, 'textures'),
    path.join(destRoot, packRel, 'Textures'),
    path.join(destRoot, packRel, 'Assets', 'textures'),
    path.join(sourceRoot, packRel, 'textures'),
    path.join(sourceRoot, packRel, 'Textures'),
    path.join(sourceRoot, packRel, 'Assets', 'textures'),
  ];

  const stems = new Set();
  for (const ref of imageRefs) {
    const stem = stemFromRef(ref);
    if (!stem) continue;
    stems.add(stem.toLowerCase());
  }

  const byLabel = new Map();

  for (const ref of imageRefs) {
    if (!ref || typeof ref !== 'object') continue;
    const uri = typeof ref.uri === 'string' ? ref.uri : null;
    if (!uri) continue;

    const resolved = toPosix(path.normalize(path.join(path.dirname(relGltfPosix), uri)));
    const label = labelFromTextureFile(uri, true);
    byLabel.set(label, {
      label,
      url: `assets/kaykit/${resolved}`,
      isDefault: true,
    });
  }

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    let names = [];
    try {
      names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      continue;
    }

    for (const name of names) {
      const lower = name.toLowerCase();
      if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg') && !lower.endsWith('.webp')) continue;

      const base = path.basename(name, path.extname(name)).toLowerCase();
      const isAlt = /(_alt_|alt_texture_)/i.test(name);
      const matchesStem = stems.size === 0
        ? isAlt
        : [...stems].some((s) => base === s || base.startsWith(`${s}_`) || s.startsWith(base));
      if (stems.size > 0 && !matchesStem) continue;
      if (stems.size === 0 && !isAlt) continue;

      const isUnderDest = toPosix(dir).startsWith(toPosix(destRoot));
      const absSrc = path.join(dir, name);
      let relUrl;

      if (isUnderDest) {
        relUrl = toPosix(path.relative(destRoot, absSrc));
      } else {
        const destTexDir = path.join(destRoot, packRel, 'textures');
        const destFile = path.join(destTexDir, name);
        if (copyFileIfChanged(absSrc, destFile)) {
          // counted in copied elsewhere is fine; sync may copy extras
        }
        relUrl = toPosix(path.relative(destRoot, destFile));
      }

      const isDefault = false;
      const matchedStem = stems.size > 0 ? [...stems].find((s) => base === s || base.startsWith(`${s}_`)) ?? null : null;
      const label = matchedStem ? labelFromStemAndFile(matchedStem, name) : labelFromTextureFile(name, isDefault);
      if (byLabel.has(label) && !isDefault) continue;
      byLabel.set(label, {
        label,
        url: `assets/kaykit/${relUrl}`,
        isDefault,
      });
    }
  }

  const variants = Array.from(byLabel.values());
  variants.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return variants.map(({ label, url }) => ({ label, url }));
};

const buildTree = (pathsPosix) => {
  const root = { name: '', path: '', type: 'dir', children: new Map() };

  for (const p of pathsPosix) {
    const parts = p.split('/').filter(Boolean);
    let node = root;
    let curPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      curPath = curPath ? `${curPath}/${part}` : part;

      if (isLeaf) {
        node.children.set(part, { name: part, path: curPath, type: 'file' });
        continue;
      }

      const existing = node.children.get(part);
      if (existing && existing.type === 'dir') {
        node = existing;
        continue;
      }

      const created = { name: part, path: curPath, type: 'dir', children: new Map() };
      node.children.set(part, created);
      node = created;
    }
  }

  const finalize = (n) => {
    if (n.type === 'file') return n;

    const children = Array.from(n.children.values()).map(finalize);
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return { name: n.name, path: n.path, type: 'dir', children };
  };

  return finalize(root);
};

const main = async () => {
  const t0 = nowMs();
  const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourceRoot;
  const destRoot = process.argv[3] ? path.resolve(process.argv[3]) : defaultDestRoot;

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Missing source root: ${sourceRoot}`);
  }

  ensureDir(destRoot);

  const topLevelDirs = listDirs(sourceRoot);
  log(`KayKit sync`);
  log(`- Source: ${sourceRoot}`);
  log(`- Dest:   ${destRoot}`);
  log(`- Top-level folders: ${topLevelDirs.length}`);

  const copyCandidates = [];
  const scanStart = nowMs();
  let scannedFiles = 0;
  const seenGltfDirs = new Set();
  const seenCharacterGlbs = new Set();
  const seenAnimationGlbs = new Set();

  for (const d of topLevelDirs) {
    const files = listFilesRecursive(d);
    scannedFiles += files.length;
    log(`Scanning: ${path.basename(d)} (${files.length} files)`);
    for (const f of files) {
      const rel = getRelativeFromSourceRoot(sourceRoot, f);
      const lower = rel.toLowerCase();

      if ((lower.endsWith('.gltf') || lower.endsWith('.glb')) && isUnderAssetsGltfFolder(rel)) {
        const relDir = toPosix(path.dirname(rel));
        if (!seenGltfDirs.has(relDir)) {
          seenGltfDirs.add(relDir);
          copyCandidates.push({ kind: 'gltfFolder', sourceFile: f });
        }
        continue;
      }

      if (lower.endsWith('.glb') && isCharacterGlbHeuristic(rel)) {
        if (!seenCharacterGlbs.has(rel)) {
          seenCharacterGlbs.add(rel);
          copyCandidates.push({ kind: 'characterGlb', sourceFile: f });
        }
        continue;
      }

      if (lower.endsWith('.glb') && isAnimationGlbHeuristic(rel)) {
        if (!seenAnimationGlbs.has(rel)) {
          seenAnimationGlbs.add(rel);
          copyCandidates.push({ kind: 'animationGlb', sourceFile: f });
        }
        continue;
      }
    }
  }

  log(`Scan complete: ${scannedFiles} files in ${formatMs(nowMs() - scanStart)}`);
  log(`Copy candidates: ${copyCandidates.length}`);

  const copied = [];
  const previewables = [];

  const copyStart = nowMs();
  let candidateIdx = 0;

  for (const c of copyCandidates) {
    candidateIdx += 1;
    if (candidateIdx === 1 || candidateIdx % 250 === 0 || candidateIdx === copyCandidates.length) {
      log(`Copying: ${candidateIdx}/${copyCandidates.length} (copied ${copied.length}, previewables ${previewables.length})`);
    }

    const rel = getRelativeFromSourceRoot(sourceRoot, c.sourceFile);
    const relDir = toPosix(path.dirname(rel));

    if (c.kind === 'gltfFolder') {
      const absDir = path.join(sourceRoot, relDir);
      const destDir = path.join(destRoot, relDir);
      const files = fs.readdirSync(absDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);

      for (const name of files) {
        const src = path.join(absDir, name);
        const dst = path.join(destDir, name);
        if (copyFileIfChanged(src, dst)) copied.push(toPosix(path.relative(destRoot, dst)));
        if (isPreviewableExt(name)) previewables.push(toPosix(path.relative(destRoot, dst)));
      }
      continue;
    }

    if (c.kind === 'characterGlb') {
      const destFile = path.join(destRoot, rel);
      if (copyFileIfChanged(c.sourceFile, destFile)) copied.push(toPosix(path.relative(destRoot, destFile)));
      previewables.push(toPosix(path.relative(destRoot, destFile)));
    }

    if (c.kind === 'animationGlb') {
      const destFile = path.join(destRoot, rel);
      if (copyFileIfChanged(c.sourceFile, destFile)) copied.push(toPosix(path.relative(destRoot, destFile)));
      previewables.push(toPosix(path.relative(destRoot, destFile)));
    }
  }

  const uniquePreviewables = Array.from(new Set(previewables)).sort((a, b) => a.localeCompare(b));
  log(`Copy complete in ${formatMs(nowMs() - copyStart)}`);
  log(`- Copied files: ${copied.length}`);
  log(`- Previewables: ${uniquePreviewables.length}`);

  const inspectStart = nowMs();
  const kindCounts = { StaticProp: 0, CharacterModel: 0, AnimationSet: 0, Unknown: 0 };
  const rigCounts = { Large: 0, Medium: 0, null: 0 };

  const entries = [];
  let inspectIdx = 0;
  for (const rel of uniquePreviewables) {
    inspectIdx += 1;
    if (inspectIdx === 1 || inspectIdx % 200 === 0 || inspectIdx === uniquePreviewables.length) {
      log(`Inspecting: ${inspectIdx}/${uniquePreviewables.length}`);
    }

    const abs = path.join(destRoot, rel);
    const ext = path.extname(rel).toLowerCase();

    let gltf;
    if (ext === '.gltf') gltf = readGltfJson(abs);
    else gltf = readGlbJsonChunk(abs);

    const { kind } = classifyGltf(gltf);
    const rigKind = kind === 'AnimationSet' ? pickRigKind(gltf) : null;
    const boneNames = getBoneNames(gltf);
    const clipNames = getClipNames(gltf);
    const images = getImageRefs(gltf);
    const textureVariants = listTextureVariantsNear(sourceRoot, destRoot, rel, images);

    if (kind in kindCounts) kindCounts[kind] += 1;
    if (kind === 'AnimationSet') {
      if (rigKind === 'Large') rigCounts.Large += 1;
      else if (rigKind === 'Medium') rigCounts.Medium += 1;
      else rigCounts.null += 1;
    }

    entries.push({
      path: rel,
      url: `assets/kaykit/${rel}`,
      kind,
      rigKind,
      boneCount: boneNames.length,
      boneNames,
      clipNames,
      images,
      bufferUris: getBufferUris(gltf),
      generator: gltf?.asset?.generator ?? null,
      textureVariants,
    });
  }

  log(`Inspect complete in ${formatMs(nowMs() - inspectStart)}`);
  log(`- Kinds: StaticProp=${kindCounts.StaticProp}, CharacterModel=${kindCounts.CharacterModel}, AnimationSet=${kindCounts.AnimationSet}, Unknown=${kindCounts.Unknown}`);
  log(`- Rigs (AnimationSet only): Large=${rigCounts.Large}, Medium=${rigCounts.Medium}, Unknown=${rigCounts.null}`);

  const manifest = {
    version: 1,
    sourceRoot: toPosix(sourceRoot),
    generatedAt: new Date().toISOString(),
    rootUrlPrefix: 'assets/kaykit/',
    tree: buildTree(uniquePreviewables),
    entries,
    stats: {
      copiedCount: copied.length,
      previewableCount: uniquePreviewables.length,
    },
  };

  const manifestPath = path.join(destRoot, 'manifest.json');
  writeUtf8(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  log(`Wrote manifest: ${manifestPath}`);
  log(`Done in ${formatMs(nowMs() - t0)}`);
};

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
});

