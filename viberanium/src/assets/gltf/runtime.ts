import { type LoadedGltf } from './loader.ts';
import { type Gltf } from './types.ts';
import { type Mat4, m4, m4Identity, m4Invert, m4Mul, m4FromTRSQuat } from '../../math/mat4.ts';
import { type Vec3, v3 } from '../../math/vec3.ts';
import { type Quat, q4, q4Copy, q4Normalize } from '../../math/quat.ts';

export type RuntimePrimitiveStatic = {
  kind: 'static';
  name: string;
  vertices: Float32Array; // interleaved pos/nrm/uv
  indices: Uint32Array;
  materialIndex: number;
  nodeIndex: number;
};

export type RuntimePrimitiveSkinned = {
  kind: 'skinned';
  name: string;
  vertices: Float32Array; // interleaved pos/nrm/uv
  joints: Uint16Array; // 4 per vertex
  weights: Float32Array; // 4 per vertex
  indices: Uint32Array;
  materialIndex: number;
  nodeIndex: number;
  skinIndex: number;
};

export type RuntimeModel = {
  name: string;
  primitives: Array<RuntimePrimitiveStatic | RuntimePrimitiveSkinned>;
};

export type RuntimeNode = {
  name: string;
  parent: number; // -1 for root
  children: number[];
  localT: Vec3;
  localR: Quat;
  localS: Vec3;
  localM: Mat4;
  worldM: Mat4;
};

export type RuntimeSkin = {
  name: string;
  joints: number[]; // node indices
  inverseBind: Mat4[]; // per joint
  skeletonRoot: number; // node index, or -1
};

export type RuntimeScene = {
  gltf: Gltf;
  nodes: RuntimeNode[];
  skins: RuntimeSkin[];
  models: RuntimeModel[]; // grouped by gltf mesh
  meshNodePairs: Array<{ nodeIndex: number; meshIndex: number; skinIndex: number }>;
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

function getAccessorView(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): { acc: NonNullable<Gltf['accessors']>[number]; view: DataView; stride: number } {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  const bv = gltf.bufferViews?.[acc.bufferView];
  if (!bv) throw new Error(`Missing bufferView ${acc.bufferView}`);
  const buf = buffers[bv.buffer];
  const offset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = bv.byteStride ?? 0;
  return { acc, view: new DataView(buf, offset, bv.byteLength - (acc.byteOffset ?? 0)), stride };
}

function readFloats(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Float32Array {
  const { acc, view, stride } = getAccessorView(gltf, buffers, accessorIndex);
  if (acc.componentType !== 5126) throw new Error(`Unsupported float componentType ${acc.componentType}`);
  const comps = numComponents(acc.type);
  const out = new Float32Array(acc.count * comps);
  const step = stride && stride !== comps * 4 ? stride : comps * 4;
  let o = 0;
  for (let i = 0; i < acc.count; i++) {
    const base = i * step;
    for (let c = 0; c < comps; c++) out[o++] = view.getFloat32(base + c * 4, true);
  }
  return out;
}

function readU16OrU8Vec4(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Uint16Array {
  const { acc, view, stride } = getAccessorView(gltf, buffers, accessorIndex);
  if (acc.type !== 'VEC4') throw new Error(`Expected VEC4 accessor, got ${acc.type}`);
  const out = new Uint16Array(acc.count * 4);
  const step = stride && stride !== 4 ? stride : 0;
  switch (acc.componentType) {
    case 5121: { // UNSIGNED_BYTE
      const s = step || 4;
      for (let i = 0; i < acc.count; i++) {
        const base = i * s;
        out[i * 4 + 0] = view.getUint8(base + 0);
        out[i * 4 + 1] = view.getUint8(base + 1);
        out[i * 4 + 2] = view.getUint8(base + 2);
        out[i * 4 + 3] = view.getUint8(base + 3);
      }
      break;
    }
    case 5123: { // UNSIGNED_SHORT
      const s = step || 8;
      for (let i = 0; i < acc.count; i++) {
        const base = i * s;
        out[i * 4 + 0] = view.getUint16(base + 0, true);
        out[i * 4 + 1] = view.getUint16(base + 2, true);
        out[i * 4 + 2] = view.getUint16(base + 4, true);
        out[i * 4 + 3] = view.getUint16(base + 6, true);
      }
      break;
    }
    default:
      throw new Error(`Unsupported JOINTS componentType ${acc.componentType}`);
  }
  return out;
}

function readWeightsVec4(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Float32Array {
  const { acc, view, stride } = getAccessorView(gltf, buffers, accessorIndex);
  if (acc.type !== 'VEC4') throw new Error(`Expected VEC4 accessor, got ${acc.type}`);
  const out = new Float32Array(acc.count * 4);
  const step = stride ? stride : 0;
  switch (acc.componentType) {
    case 5126: { // FLOAT
      const s = step || 16;
      for (let i = 0; i < acc.count; i++) {
        const base = i * s;
        out[i * 4 + 0] = view.getFloat32(base + 0, true);
        out[i * 4 + 1] = view.getFloat32(base + 4, true);
        out[i * 4 + 2] = view.getFloat32(base + 8, true);
        out[i * 4 + 3] = view.getFloat32(base + 12, true);
      }
      break;
    }
    case 5121: { // U8 normalized
      const s = step || 4;
      for (let i = 0; i < acc.count; i++) {
        const base = i * s;
        out[i * 4 + 0] = view.getUint8(base + 0) / 255;
        out[i * 4 + 1] = view.getUint8(base + 1) / 255;
        out[i * 4 + 2] = view.getUint8(base + 2) / 255;
        out[i * 4 + 3] = view.getUint8(base + 3) / 255;
      }
      break;
    }
    case 5123: { // U16 normalized
      const s = step || 8;
      for (let i = 0; i < acc.count; i++) {
        const base = i * s;
        out[i * 4 + 0] = view.getUint16(base + 0, true) / 65535;
        out[i * 4 + 1] = view.getUint16(base + 2, true) / 65535;
        out[i * 4 + 2] = view.getUint16(base + 4, true) / 65535;
        out[i * 4 + 3] = view.getUint16(base + 6, true) / 65535;
      }
      break;
    }
    default:
      throw new Error(`Unsupported WEIGHTS componentType ${acc.componentType}`);
  }
  return out;
}

function readIndices(gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Uint32Array {
  const { acc, view, stride } = getAccessorView(gltf, buffers, accessorIndex);
  if (stride) {
    // Indices are expected tightly packed; ignore stride.
    void stride;
  }
  const out = new Uint32Array(acc.count);
  switch (acc.componentType) {
    case 5123: // UNSIGNED_SHORT
      for (let i = 0; i < acc.count; i++) out[i] = view.getUint16(i * 2, true);
      break;
    case 5125: // UNSIGNED_INT
      for (let i = 0; i < acc.count; i++) out[i] = view.getUint32(i * 4, true);
      break;
    default:
      throw new Error(`Unsupported index componentType ${acc.componentType}`);
  }
  return out;
}

function nodeName(n: NonNullable<Gltf['nodes']>[number] | undefined, idx: number): string {
  return n?.name ?? `node${idx}`;
}

export function buildRuntimeScene(loaded: LoadedGltf): RuntimeScene {
  const { gltf, buffers } = loaded;

  // Nodes
  const nodes: RuntimeNode[] = [];
  const parents = new Array<number>((gltf.nodes?.length ?? 0)).fill(-1);
  for (let i = 0; i < (gltf.nodes?.length ?? 0); i++) {
    const n = gltf.nodes![i];
    const t = v3(n.translation?.[0] ?? 0, n.translation?.[1] ?? 0, n.translation?.[2] ?? 0);
    const r = q4(n.rotation?.[0] ?? 0, n.rotation?.[1] ?? 0, n.rotation?.[2] ?? 0, n.rotation?.[3] ?? 1);
    q4Normalize(r, r);
    const s = v3(n.scale?.[0] ?? 1, n.scale?.[1] ?? 1, n.scale?.[2] ?? 1);
    const localM = m4();
    if (n.matrix && n.matrix.length === 16) {
      localM.set(new Float32Array(n.matrix));
    } else {
      m4FromTRSQuat(localM, t, r, s);
    }
    nodes.push({
      name: nodeName(n, i),
      parent: -1,
      children: (n.children ?? []).slice(),
      localT: t,
      localR: r,
      localS: s,
      localM,
      worldM: m4(),
    });
  }
  for (let i = 0; i < nodes.length; i++) {
    for (const c of nodes[i].children) parents[c] = i;
  }
  for (let i = 0; i < nodes.length; i++) nodes[i].parent = parents[i] ?? -1;

  // Skins
  const skins: RuntimeSkin[] = [];
  for (let si = 0; si < (gltf.skins?.length ?? 0); si++) {
    const s = gltf.skins![si];
    const inv: Mat4[] = [];
    if (s.inverseBindMatrices !== undefined) {
      const mats = readFloats(gltf, buffers, s.inverseBindMatrices);
      for (let j = 0; j < s.joints.length; j++) {
        const m = m4();
        m.set(mats.subarray(j * 16, j * 16 + 16));
        inv.push(m);
      }
    } else {
      for (let j = 0; j < s.joints.length; j++) inv.push(m4Identity(m4()));
    }
    skins.push({
      name: s.name ?? `skin${si}`,
      joints: s.joints.slice(),
      inverseBind: inv,
      skeletonRoot: s.skeleton ?? -1,
    });
  }

  // Build mesh -> primitives (no node transform baked; we apply node matrix at render time via u_model)
  const models: RuntimeModel[] = [];
  for (let mi = 0; mi < (gltf.meshes?.length ?? 0); mi++) {
    const mesh = gltf.meshes![mi];
    const primitives: Array<RuntimePrimitiveStatic | RuntimePrimitiveSkinned> = [];
    for (let pi = 0; pi < mesh.primitives.length; pi++) {
      const prim = mesh.primitives[pi];
      const mode = prim.mode ?? 4;
      if (mode !== 4) continue;
      const posAcc = prim.attributes['POSITION'];
      const nrmAcc = prim.attributes['NORMAL'];
      const uvAcc = prim.attributes['TEXCOORD_0'];
      if (posAcc === undefined) continue;

      const pos = readFloats(gltf, buffers, posAcc);
      const nrm = nrmAcc !== undefined ? readFloats(gltf, buffers, nrmAcc) : new Float32Array((pos.length / 3) * 3);
      const uv = uvAcc !== undefined ? readFloats(gltf, buffers, uvAcc) : new Float32Array((pos.length / 3) * 2);

      const vCount = pos.length / 3;
      const vertices = new Float32Array(vCount * 8);
      for (let v = 0; v < vCount; v++) {
        const pOff = v * 3;
        const nOff = v * 3;
        const uOff = v * 2;
        const o = v * 8;
        vertices[o + 0] = pos[pOff + 0];
        vertices[o + 1] = pos[pOff + 1];
        vertices[o + 2] = pos[pOff + 2];
        vertices[o + 3] = nrm[nOff + 0];
        vertices[o + 4] = nrm[nOff + 1];
        vertices[o + 5] = nrm[nOff + 2];
        vertices[o + 6] = uv[uOff + 0];
        vertices[o + 7] = uv[uOff + 1];
      }

      const indices =
        prim.indices !== undefined
          ? readIndices(gltf, buffers, prim.indices)
          : (() => {
              const idx = new Uint32Array(vCount);
              for (let i = 0; i < vCount; i++) idx[i] = i;
              return idx;
            })();

      const jointsAcc = prim.attributes['JOINTS_0'];
      const weightsAcc = prim.attributes['WEIGHTS_0'];
      if (jointsAcc !== undefined && weightsAcc !== undefined) {
        const joints = readU16OrU8Vec4(gltf, buffers, jointsAcc);
        const weights = readWeightsVec4(gltf, buffers, weightsAcc);
        primitives.push({
          kind: 'skinned',
          name: `mesh${mi}_prim${pi}`,
          vertices,
          joints,
          weights,
          indices,
          materialIndex: prim.material ?? -1,
          nodeIndex: -1,
          skinIndex: -1,
        });
      } else {
        primitives.push({
          kind: 'static',
          name: `mesh${mi}_prim${pi}`,
          vertices,
          indices,
          materialIndex: prim.material ?? -1,
          nodeIndex: -1,
        });
      }
    }
    models.push({ name: `mesh${mi}`, primitives });
  }

  // Node -> mesh references
  const meshNodePairs: Array<{ nodeIndex: number; meshIndex: number; skinIndex: number }> = [];
  for (let ni = 0; ni < (gltf.nodes?.length ?? 0); ni++) {
    const n = gltf.nodes![ni];
    if (n.mesh === undefined) continue;
    meshNodePairs.push({ nodeIndex: ni, meshIndex: n.mesh, skinIndex: n.skin ?? -1 });
  }

  // Initial world matrices (bind pose)
  updateWorldFromLocals(nodes);

  // Patch primitive node/skin indices for convenience
  for (const pair of meshNodePairs) {
    const m = models[pair.meshIndex];
    if (!m) continue;
    for (const p of m.primitives) {
      p.nodeIndex = pair.nodeIndex;
      if (p.kind === 'skinned') p.skinIndex = pair.skinIndex;
    }
  }

  return { gltf, nodes, skins, models, meshNodePairs };
}

export function updateWorldFromLocals(nodes: RuntimeNode[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    // If a node has a baked matrix in glTF, localM is authoritative; otherwise rebuild from TRS.
    // We rebuild every frame because animation modifies TRS.
    m4FromTRSQuat(n.localM, n.localT, n.localR, n.localS);
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.parent < 0) {
      n.worldM.set(n.localM);
    } else {
      m4Mul(n.worldM, nodes[n.parent].worldM, n.localM);
    }
  }
}

const _invMeshWorld = m4();
const _tmpA = m4();
const _tmpB = m4();

export function computeSkinPalette(
  nodes: RuntimeNode[],
  skin: RuntimeSkin,
  paletteOut: Float32Array,
  entityWorld: Mat4,
  meshWorld: Mat4,
): void {
  // paletteOut layout: jointCount * 16 floats
  m4Invert(_invMeshWorld, meshWorld);
  for (let j = 0; j < skin.joints.length; j++) {
    const nodeIdx = skin.joints[j];
    const jointLocalWorld = nodes[nodeIdx].worldM;
    // jointWorld = entityWorld * jointLocalWorld
    m4Mul(_tmpA, entityWorld, jointLocalWorld);
    // jointMatrix = invMeshWorld * jointWorld * inverseBind
    m4Mul(_tmpB, _invMeshWorld, _tmpA);
    const invBind = skin.inverseBind[j];
    const outOff = j * 16;
    const outM = paletteOut.subarray(outOff, outOff + 16);
    m4Mul(outM as unknown as Mat4, _tmpB, invBind);
  }
}

export function buildNodeNameMap(nodes: RuntimeNode[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) map.set(nodes[i].name, i);
  return map;
}

export type RuntimePose = {
  t: Vec3[];
  r: Quat[];
  s: Vec3[];
};

export function snapshotPose(nodes: RuntimeNode[]): RuntimePose {
  const t: Vec3[] = [];
  const r: Quat[] = [];
  const s: Vec3[] = [];
  for (const n of nodes) {
    t.push(v3(n.localT[0], n.localT[1], n.localT[2]));
    r.push(q4(n.localR[0], n.localR[1], n.localR[2], n.localR[3]));
    s.push(v3(n.localS[0], n.localS[1], n.localS[2]));
  }
  return { t, r, s };
}

export function applyPose(nodes: RuntimeNode[], pose: RuntimePose): void {
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].localT.set(pose.t[i]);
    nodes[i].localS.set(pose.s[i]);
    q4Copy(nodes[i].localR, pose.r[i]);
  }
}

