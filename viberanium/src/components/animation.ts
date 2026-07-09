import { type LoadedGltf } from '../assets/gltf/loader.ts';
import { type Gltf } from '../assets/gltf/types.ts';
import { type RuntimeNode, buildNodeNameMap } from '../assets/gltf/runtime.ts';
import { q4, q4Slerp } from '../math/quat.ts';

type ChannelPath = 'translation' | 'rotation' | 'scale';

export type AnimChannel = {
  targetNodeIndex: number;
  path: ChannelPath;
  times: Float32Array;
  values: Float32Array;
};

export type AnimClip = {
  name: string;
  duration: number;
  channels: AnimChannel[];
  animatedNodes?: number[];
};

const clipAnimatedNodes = new WeakMap<AnimClip, number[]>();

export const getClipAnimatedNodes = (clip: AnimClip): number[] => {
  const cached = clip.animatedNodes ?? clipAnimatedNodes.get(clip);
  if (cached) return cached;

  const seen = new Set<number>();
  const nodes: number[] = [];
  for (const ch of clip.channels) {
    if (seen.has(ch.targetNodeIndex)) continue;
    seen.add(ch.targetNodeIndex);
    nodes.push(ch.targetNodeIndex);
  }

  clip.animatedNodes = nodes;
  clipAnimatedNodes.set(clip, nodes);
  return nodes;
};

const numComponents = (type: string): number => {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    case 'MAT4': return 16;
    default: return 1;
  }
};

const getAccessorView = (gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): DataView => {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  const bv = gltf.bufferViews?.[acc.bufferView];
  if (!bv) throw new Error(`Missing bufferView ${acc.bufferView}`);
  const buf = buffers[bv.buffer];
  const offset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return new DataView(buf, offset, bv.byteLength - (acc.byteOffset ?? 0));
};

const readFloats = (gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Float32Array => {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  if (acc.componentType !== 5126) throw new Error(`Unsupported float componentType ${acc.componentType}`);
  const view = getAccessorView(gltf, buffers, accessorIndex);
  const comps = numComponents(acc.type);
  const out = new Float32Array(acc.count * comps);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
};

export const buildRetargetedClips = (animSource: LoadedGltf, targetNodes: RuntimeNode[]): AnimClip[] => {
  const src = animSource.gltf;
  const nameToTarget = buildNodeNameMap(targetNodes);
  const clips: AnimClip[] = [];

  for (let ai = 0; ai < (src.animations?.length ?? 0); ai++) {
    const a = src.animations![ai];
    const channels: AnimChannel[] = [];
    let duration = 0;

    for (const ch of a.channels) {
      const sampler = a.samplers[ch.sampler];
      const path = ch.target.path;
      if (path === 'weights') continue;
      const srcNodeIndex = ch.target.node;
      const srcNodeName = src.nodes?.[srcNodeIndex]?.name;
      if (!srcNodeName) continue;
      const targetNodeIndex = nameToTarget.get(srcNodeName);
      if (targetNodeIndex === undefined) continue;

      const times = readFloats(src, animSource.buffers, sampler.input);
      const values = readFloats(src, animSource.buffers, sampler.output);
      const clipDur = times.length ? times[times.length - 1] : 0;
      if (clipDur > duration) duration = clipDur;

      channels.push({ targetNodeIndex, path, times, values });
    }

    clips.push({ name: a.name ?? `anim${ai}`, duration: Math.max(1e-6, duration), channels });
  }

  return clips;
};

const findKeyframe = (times: Float32Array, t: number): number => {
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  return Math.max(0, Math.min(times.length - 2, lo - 1));
};

const _qa = q4();
const _qb = q4();
const _qout = q4();

export const sampleClipToNodes = (
  clip: AnimClip,
  nodes: RuntimeNode[],
  time: number,
  weight: number,
  loop = true,
): void => {
  const w = Math.max(0, Math.min(1, weight));
  if (w <= 0) return;
  const fullWeight = w >= 0.999;
  let t = Math.max(0, time);
  if (clip.duration > 0) {
    t = loop ? ((t % clip.duration) + clip.duration) % clip.duration : Math.min(t, clip.duration);
  }

  for (const ch of clip.channels) {
    const n = nodes[ch.targetNodeIndex];
    const times = ch.times;
    if (times.length === 0) continue;

    if (times.length === 1) {
      const base = 0;
      if (ch.path === 'translation') {
        if (fullWeight) {
          n.localT[0] = ch.values[base];
          n.localT[1] = ch.values[base + 1];
          n.localT[2] = ch.values[base + 2];
        } else {
          n.localT[0] += (ch.values[base] - n.localT[0]) * w;
          n.localT[1] += (ch.values[base + 1] - n.localT[1]) * w;
          n.localT[2] += (ch.values[base + 2] - n.localT[2]) * w;
        }
      } else if (ch.path === 'scale') {
        if (fullWeight) {
          n.localS[0] = ch.values[base];
          n.localS[1] = ch.values[base + 1];
          n.localS[2] = ch.values[base + 2];
        } else {
          n.localS[0] += (ch.values[base] - n.localS[0]) * w;
          n.localS[1] += (ch.values[base + 1] - n.localS[1]) * w;
          n.localS[2] += (ch.values[base + 2] - n.localS[2]) * w;
        }
      } else if (fullWeight) {
        n.localR[0] = ch.values[base];
        n.localR[1] = ch.values[base + 1];
        n.localR[2] = ch.values[base + 2];
        n.localR[3] = ch.values[base + 3];
      } else {
        _qa[0] = ch.values[base]; _qa[1] = ch.values[base + 1]; _qa[2] = ch.values[base + 2]; _qa[3] = ch.values[base + 3];
        q4Slerp(n.localR, n.localR, _qa, w);
      }
      continue;
    }

    const i = findKeyframe(times, t);
    const t0 = times[i];
    const t1 = times[i + 1];
    const alpha = t1 > t0 ? (t - t0) / (t1 - t0) : 0;

    if (ch.path === 'translation' || ch.path === 'scale') {
      const base0 = i * 3;
      const base1 = (i + 1) * 3;
      const x = ch.values[base0] + (ch.values[base1] - ch.values[base0]) * alpha;
      const y = ch.values[base0 + 1] + (ch.values[base1 + 1] - ch.values[base0 + 1]) * alpha;
      const z = ch.values[base0 + 2] + (ch.values[base1 + 2] - ch.values[base0 + 2]) * alpha;
      const dst = ch.path === 'translation' ? n.localT : n.localS;
      if (fullWeight) {
        dst[0] = x;
        dst[1] = y;
        dst[2] = z;
      } else {
        dst[0] += (x - dst[0]) * w;
        dst[1] += (y - dst[1]) * w;
        dst[2] += (z - dst[2]) * w;
      }
    } else {
      const base0 = i * 4;
      const base1 = (i + 1) * 4;
      _qa[0] = ch.values[base0]; _qa[1] = ch.values[base0 + 1]; _qa[2] = ch.values[base0 + 2]; _qa[3] = ch.values[base0 + 3];
      _qb[0] = ch.values[base1]; _qb[1] = ch.values[base1 + 1]; _qb[2] = ch.values[base1 + 2]; _qb[3] = ch.values[base1 + 3];
      if (fullWeight) {
        q4Slerp(n.localR, _qa, _qb, alpha);
      } else {
        q4Slerp(_qout, _qa, _qb, alpha);
        q4Slerp(n.localR, n.localR, _qout, w);
      }
    }
  }
};
