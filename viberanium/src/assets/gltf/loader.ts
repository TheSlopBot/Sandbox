import { type Gltf } from './types.ts';

export type LoadedGltf = {
  url: string;
  gltf: Gltf;
  buffers: ArrayBuffer[];
  images: ImageBitmap[];
  resolvedImageUris: string[];
};

const resolveRelativeUrl = (baseUrl: string, rel: string): string => {
  const u = new URL(baseUrl, window.location.href);
  const base = u.href.endsWith('/') ? u.href : u.href.replace(/[^/]*$/, '');
  return new URL(rel, base).href;
};

const isLikelyGlb = (url: string): boolean => url.toLowerCase().endsWith('.glb');

const parseGlb = (buf: ArrayBuffer): { gltf: Gltf; binChunk: ArrayBuffer | null } => {
  const dv = new DataView(buf);
  const magic =
    String.fromCharCode(dv.getUint8(0)) +
    String.fromCharCode(dv.getUint8(1)) +
    String.fromCharCode(dv.getUint8(2)) +
    String.fromCharCode(dv.getUint8(3));
  if (magic !== 'glTF') throw new Error('Invalid GLB magic');

  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);

  const totalLength = dv.getUint32(8, true);
  if (totalLength !== buf.byteLength) {
    // Some exporters pad; tolerate if buffer is at least totalLength.
    if (buf.byteLength < totalLength) throw new Error('Truncated GLB');
  }

  let off = 12;
  let jsonText: string | null = null;
  let bin: ArrayBuffer | null = null;
  while (off + 8 <= buf.byteLength) {
    const chunkLength = dv.getUint32(off, true);
    const chunkType = dv.getUint32(off + 4, true);
    off += 8;
    if (off + chunkLength > buf.byteLength) break;

    const chunk = buf.slice(off, off + chunkLength);
    off += chunkLength;

    // JSON = 0x4E4F534A, BIN = 0x004E4942
    if (chunkType === 0x4e4f534a) {
      const bytes = new Uint8Array(chunk);
      jsonText = new TextDecoder('utf-8').decode(bytes);
    } else if (chunkType === 0x004e4942) {
      bin = chunk;
    }
  }

  if (!jsonText) throw new Error('GLB missing JSON chunk');
  const gltf = JSON.parse(jsonText) as Gltf;
  return { gltf, binChunk: bin };
};

export const loadGltf = async (url: string): Promise<LoadedGltf> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch glTF: ${url}`);

  let gltf: Gltf;
  let glbBin: ArrayBuffer | null = null;
  if (isLikelyGlb(url)) {
    const buf = await res.arrayBuffer();
    const parsed = parseGlb(buf);
    gltf = parsed.gltf;
    glbBin = parsed.binChunk;
  } else {
    gltf = (await res.json()) as Gltf;
  }

  const buffers: ArrayBuffer[] = [];
  for (let i = 0; i < (gltf.buffers ?? []).length; i++) {
    const b = gltf.buffers![i];
    if (!b.uri) {
      if (!glbBin) throw new Error(`Buffer ${i} has no uri (expected GLB BIN chunk)`);
      buffers.push(glbBin);
      continue;
    }
    const bufUrl = resolveRelativeUrl(url, b.uri);
    const r = await fetch(bufUrl);
    if (!r.ok) throw new Error(`Failed to fetch buffer: ${bufUrl}`);
    buffers.push(await r.arrayBuffer());
  }

  const images: ImageBitmap[] = [];
  const resolvedImageUris: string[] = [];
  for (let i = 0; i < (gltf.images ?? []).length; i++) {
    const img = gltf.images![i];
    if (img.uri) {
      const imgUrl = resolveRelativeUrl(url, img.uri);
      const r = await fetch(imgUrl);
      if (!r.ok) throw new Error(`Failed to fetch image: ${imgUrl}`);
      const blob = await r.blob();
      images.push(await createImageBitmap(blob));
      resolvedImageUris.push(imgUrl);
      continue;
    }

    // Embedded image (bufferView)
    if (img.bufferView === undefined) throw new Error(`Image ${i} missing uri/bufferView`);
    if (!img.mimeType) throw new Error(`Image ${i} missing mimeType for bufferView image`);
    const bv = gltf.bufferViews?.[img.bufferView];
    if (!bv) throw new Error(`Missing bufferView ${img.bufferView} for image ${i}`);
    const buf = buffers[bv.buffer];
    const start = bv.byteOffset ?? 0;
    const bytes = buf.slice(start, start + bv.byteLength);
    const blob = new Blob([bytes], { type: img.mimeType });
    images.push(await createImageBitmap(blob));
    resolvedImageUris.push(`${url}#image${i}`);
  }

  return { url, gltf, buffers, images, resolvedImageUris };
};

