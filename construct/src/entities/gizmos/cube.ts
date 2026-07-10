import {
  type Registry,
  type RenderPipeline,
  type Transform,
  type Mat4,
  type Vec3,
  createTransform,
  createInterleavedMesh,
  destroyMesh,
  m4,
  m4Copy,
  m4FromTRS,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';

export type ConstructOrientationCube = {
  size: number;
};

export const createConstructOrientationCube = (
  size = 0.12,
): ConstructOrientationCube => ({
  size,
});

const createOrientationCubeMesh = (gl: WebGL2RenderingContext, half: number) => {
  const v: number[] = [];
  const idx: number[] = [];
  const push = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ) => {
    v.push(x, y, z, nx, ny, nz, 0, 0);
  };
  const faces: Array<{ n: [number, number, number]; corners: [number, number, number][] }> = [
    { n: [0, 0, 1], corners: [[-half, -half, half], [half, -half, half], [half, half, half], [-half, half, half]] },
    { n: [0, 0, -1], corners: [[half, -half, -half], [-half, -half, -half], [-half, half, -half], [half, half, -half]] },
    { n: [0, 1, 0], corners: [[-half, half, -half], [-half, half, half], [half, half, half], [half, half, -half]] },
    { n: [0, -1, 0], corners: [[-half, -half, half], [-half, -half, -half], [half, -half, -half], [half, -half, half]] },
    { n: [1, 0, 0], corners: [[half, -half, -half], [half, half, -half], [half, half, half], [half, -half, half]] },
    { n: [-1, 0, 0], corners: [[-half, -half, half], [-half, half, half], [-half, half, -half], [-half, -half, -half]] },
  ];
  let base = 0;
  for (const face of faces) {
    for (const c of face.corners) push(c[0], c[1], c[2], face.n[0], face.n[1], face.n[2]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

export type OrientationCubeController = {
  destroy: () => void;
};

export const spawnOrientationCube = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  pipeline: RenderPipeline,
): OrientationCubeController => {
  let mesh = createOrientationCubeMesh(gl, 0.5);
  let entityId: number | null = null;

  const createEntity = () => {
    const ent = registry.createBare();
    const t = createTransform();
    t.dirty = false;
    const model = m4();
    ent.components[COMPONENT_KEYS.transform] = t;
    ent.components[CONSTRUCT_KEYS.orientationCube] = createConstructOrientationCube();
    ent.components[COMPONENT_KEYS.renderable] = {
      mesh,
      material: {
        name: 'construct-orientation-cube',
        baseColorTex: null,
        baseColorFactor: [0.82, 0.84, 0.88, 1],
        alphaMode: 'OPAQUE',
        doubleSided: false,
      },
      model,
      visible: true,
      castShadow: false,
      overlay: true,
    };
    registry.register(ent);
    entityId = ent.id;
    return ent;
  };

  createEntity();

  const _pos = v3();
  const _fwd = v3();
  const _right = v3();
  const _up = v3();

  const removeAction = registry.addAction('update', () => {
    let entity = entityId !== null ? registry.get(entityId) : undefined;
    if (!entity) {
      const existing = registry.view(CONSTRUCT_KEYS.orientationCube)[0];
      if (existing) {
        entity = existing;
        entityId = existing.id;
      } else {
        destroyMesh(gl, mesh);
        mesh = createOrientationCubeMesh(gl, 0.5);
        entity = createEntity();
      }
    }

    const transform = entity.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const cube = entity.components[CONSTRUCT_KEYS.orientationCube] as ConstructOrientationCube | undefined;
    const renderable = entity.components[COMPONENT_KEYS.renderable] as { model?: Mat4; visible?: boolean } | undefined;
    if (!transform || !cube || !renderable?.model) return;

    const cam = pipeline.camera.position;
    const target = pipeline.target;
    _fwd[0] = target[0] - cam[0];
    _fwd[1] = target[1] - cam[1];
    _fwd[2] = target[2] - cam[2];
    const fLen = Math.hypot(_fwd[0], _fwd[1], _fwd[2]) || 1;
    _fwd[0] /= fLen;
    _fwd[1] /= fLen;
    _fwd[2] /= fLen;

    _right[0] = _fwd[2];
    _right[1] = 0;
    _right[2] = -_fwd[0];
    const rLen = Math.hypot(_right[0], _right[1], _right[2]) || 1;
    _right[0] /= rLen;
    _right[1] /= rLen;
    _right[2] /= rLen;

    _up[0] = _right[1] * _fwd[2] - _right[2] * _fwd[1];
    _up[1] = _right[2] * _fwd[0] - _right[0] * _fwd[2];
    _up[2] = _right[0] * _fwd[1] - _right[1] * _fwd[0];

    const dist = 2.4;
    const insetRight = 0.85;
    const insetUp = 0.55;
    _pos[0] = cam[0] + _fwd[0] * dist + _right[0] * insetRight + _up[0] * insetUp;
    _pos[1] = cam[1] + _fwd[1] * dist + _right[1] * insetRight + _up[1] * insetUp;
    _pos[2] = cam[2] + _fwd[2] * dist + _right[2] * insetRight + _up[2] * insetUp;

    transform.position[0] = _pos[0];
    transform.position[1] = _pos[1];
    transform.position[2] = _pos[2];
    m4FromTRS(renderable.model, _pos as Vec3, 0, v3(cube.size, cube.size, cube.size));
    m4Copy(transform.world, renderable.model);
    transform.dirty = false;
    renderable.visible = true;
  }, 26);

  return {
    destroy: () => {
      removeAction();
      if (entityId !== null && registry.get(entityId)) registry.deregister(entityId);
      destroyMesh(gl, mesh);
    },
  };
};
