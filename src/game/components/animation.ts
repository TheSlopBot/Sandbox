import { type LoadedGltf } from '../../assets/gltf/loader.ts';
import { type Gltf } from '../../assets/gltf/types.ts';
import { type RuntimeNode, buildNodeNameMap } from '../../assets/gltf/runtime.ts';
import { v3 } from '../../math/vec3.ts';
import { q4, q4Slerp, q4Normalize } from '../../math/quat.ts';

type ChannelPath = 'translation' | 'rotation' | 'scale';

export type AnimChannel = {
  targetNodeIndex: number;
  path: ChannelPath;
  times: Float32Array;
  values: Float32Array; // vec3 or quat stream
};

export type AnimClip = {
  name: string;
  duration: number;
  channels: AnimChannel[];
};

function numComponents(type: string): number {
  switch (type) {
    case 'SCALAR':
      return 1;
    case 'VEC2':
      return 2;
    case 'VEC3':
      return 3;
    case 'VEC4':
      return 4;
    case 'MAT4':
      return 16;
    default:
      return 1;
  }
}

function getAccessorView(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): DataView {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  const bv = gltf.bufferViews?.[acc.bufferView];
  if (!bv) throw new Error(`Missing bufferView ${acc.bufferView}`);
  const buf = buffers[bv.buffer];
  const offset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return new DataView(buf, offset, bv.byteLength - (acc.byteOffset ?? 0));
}

function readFloats(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Float32Array {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  if (acc.componentType !== 5126) throw new Error(`Unsupported float componentType ${acc.componentType}`);
  const view = getAccessorView(gltf, buffers, accessorIndex);
  const comps = numComponents(acc.type);
  const out = new Float32Array(acc.count * comps);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

export function buildRetargetedClips(
  animSource: LoadedGltf,
  targetNodes: RuntimeNode[],
): AnimClip[] {
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
}

function findKeyframe(times: Float32Array, t: number): number {
  // returns i such that times[i] <= t < times[i+1]
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  return Math.max(0, Math.min(times.length - 2, lo - 1));
}

const _qa = q4();
const _qb = q4();
const _qout = q4();
const _va = v3();
const _vb = v3();

export function sampleClipToNodes(
  clip: AnimClip,
  nodes: RuntimeNode[],
  time: number,
  weight: number,
  loop = true,
): void {
  const w = Math.max(0, Math.min(1, weight));
  if (w <= 0) return;
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
        _va[0] = ch.values[base + 0]; _va[1] = ch.values[base + 1]; _va[2] = ch.values[base + 2];
        n.localT[0] = n.localT[0] + (_va[0] - n.localT[0]) * w;
        n.localT[1] = n.localT[1] + (_va[1] - n.localT[1]) * w;
        n.localT[2] = n.localT[2] + (_va[2] - n.localT[2]) * w;
      } else if (ch.path === 'scale') {
        _va[0] = ch.values[base + 0]; _va[1] = ch.values[base + 1]; _va[2] = ch.values[base + 2];
        n.localS[0] = n.localS[0] + (_va[0] - n.localS[0]) * w;
        n.localS[1] = n.localS[1] + (_va[1] - n.localS[1]) * w;
        n.localS[2] = n.localS[2] + (_va[2] - n.localS[2]) * w;
      } else {
        _qa[0] = ch.values[base + 0]; _qa[1] = ch.values[base + 1]; _qa[2] = ch.values[base + 2]; _qa[3] = ch.values[base + 3];
        q4Normalize(_qa, _qa);
        q4Slerp(_qout, n.localR, _qa, w);
        n.localR.set(_qout);
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
      _va[0] = ch.values[base0 + 0];
      _va[1] = ch.values[base0 + 1];
      _va[2] = ch.values[base0 + 2];
      _vb[0] = ch.values[base1 + 0];
      _vb[1] = ch.values[base1 + 1];
      _vb[2] = ch.values[base1 + 2];
      const x = _va[0] + (_vb[0] - _va[0]) * alpha;
      const y = _va[1] + (_vb[1] - _va[1]) * alpha;
      const z = _va[2] + (_vb[2] - _va[2]) * alpha;
      const dst = ch.path === 'translation' ? n.localT : n.localS;
      dst[0] = dst[0] + (x - dst[0]) * w;
      dst[1] = dst[1] + (y - dst[1]) * w;
      dst[2] = dst[2] + (z - dst[2]) * w;
    } else {
      const base0 = i * 4;
      const base1 = (i + 1) * 4;
      _qa[0] = ch.values[base0 + 0];
      _qa[1] = ch.values[base0 + 1];
      _qa[2] = ch.values[base0 + 2];
      _qa[3] = ch.values[base0 + 3];
      _qb[0] = ch.values[base1 + 0];
      _qb[1] = ch.values[base1 + 1];
      _qb[2] = ch.values[base1 + 2];
      _qb[3] = ch.values[base1 + 3];
      q4Normalize(_qa, _qa);
      q4Normalize(_qb, _qb);
      q4Slerp(_qout, _qa, _qb, alpha);
      q4Slerp(_qout, n.localR, _qout, w);
      n.localR.set(_qout);
    }
  }
}

