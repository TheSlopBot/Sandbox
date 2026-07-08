import { type LoadedGltf } from './loader.ts';
import { type Gltf } from './types.ts';

export type RuntimePrimitive = {
  name: string;
  vertices: Float32Array;
  indices: Uint32Array;
  materialIndex: number;
};

export type RuntimeModel = {
  name: string;
  primitives: RuntimePrimitive[];
};

const numComponents = (type: string): number => {
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

const readIndices = (gltf: Gltf, buffers: ArrayBuffer[], accessorIndex: number): Uint32Array => {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc) throw new Error(`Missing accessor ${accessorIndex}`);
  const view = getAccessorView(gltf, buffers, accessorIndex);
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
};

export const buildRuntimeModel = (loaded: LoadedGltf): RuntimeModel[] => {
  const { gltf, buffers } = loaded;
  const models: RuntimeModel[] = [];

  for (let mi = 0; mi < (gltf.meshes?.length ?? 0); mi++) {
    const mesh = gltf.meshes![mi];
    const primitives: RuntimePrimitive[] = [];
    for (let pi = 0; pi < mesh.primitives.length; pi++) {
      const prim = mesh.primitives[pi];
      const mode = prim.mode ?? 4; // TRIANGLES
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

      const indices = prim.indices !== undefined ? readIndices(gltf, buffers, prim.indices) : (() => {
        const idx = new Uint32Array(vCount);
        for (let i = 0; i < vCount; i++) idx[i] = i;
        return idx;
      })();

      primitives.push({
        name: `mesh${mi}_prim${pi}`,
        vertices,
        indices,
        materialIndex: prim.material ?? -1,
      });
    }
    models.push({ name: `mesh${mi}`, primitives });
  }

  return models;
};

