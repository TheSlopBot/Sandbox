import {
  type GltfCache,
  type Material,
  type Registry,
  type RenderPipeline,
  type TextureCache,
  createTextureCache,
  buildGltfMaterials,
  buildRetargetedClips,
  buildRuntimeScene,
  createCharacterController,
  createGltfCache,
  createStaticModel,
  createRenderGroup,
  createSkeletalModel,
  createMeshDraws,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createInterleavedMesh,
  createSkinInstance,
  createSkinnedMesh,
  createTransform,
  destroyMesh,
  installRenderPipeline,
  installStaticModelSystem,
  installSkeletalCharacterSystems,
  installCharacterStateSystem,
  m4,
  useGame,
  useScene,
  COMPONENT_KEYS,
  type MeshDrawPart,
} from 'viberanium';
import {
  PREVIEW_KEYS,
  createPreviewAnim,
  createPreviewOrbit,
  createPreviewOrbitOriginMarker,
  frameOrbitOnBounds,
  type PreviewAnim,
  type PreviewOrbit,
} from '../ecs/previewComponents.ts';
import { installPreviewOrbitSystem } from '../ecs/orbitSystem.ts';
import { createGroundMesh } from '../world/ground.ts';
import {
  boundsCenter,
  boundsRadius,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from './modelBounds.ts';

export type PreviewTextureVariant = {
  label: string;
  url: string;
};

export type PreviewSession = {
  canvas: HTMLCanvasElement;
  gameRegistry: Registry;
  sceneRegistry: Registry;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  setActive: (active: boolean) => void;
  loadModel: (modelUrl: string, textureVariants?: PreviewTextureVariant[]) => Promise<PreviewLoadedModel>;
  loadAnimationPack: (packUrl: string) => Promise<PreviewLoadedAnimationPack>;
  applyClip: (clipName: string) => void;
  setTextureVariant: (variantUrl: string | null) => Promise<void>;
  unload: () => void;
};

export type PreviewLoadedModel = {
  kind: 'StaticProp' | 'CharacterModel';
  modelUrl: string;
  boneNames: string[];
  textureVariants: PreviewTextureVariant[];
  activeTextureVariantUrl: string | null;
};

export type PreviewLoadedAnimationPack = {
  packUrl: string;
  clipNames: string[];
};

const buildUvSphere = (radius: number, rings: number, segments: number) => {
  const rr = Math.max(3, rings);
  const ss = Math.max(3, segments);

  const vertexCount = (rr + 1) * (ss + 1);
  const v = new Float32Array(vertexCount * 8);

  let vi = 0;
  for (let r = 0; r <= rr; r++) {
    const vFrac = r / rr;
    const phi = vFrac * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let s = 0; s <= ss; s++) {
      const uFrac = s / ss;
      const theta = uFrac * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;

      v[vi++] = nx * radius;
      v[vi++] = ny * radius;
      v[vi++] = nz * radius;
      v[vi++] = nx;
      v[vi++] = ny;
      v[vi++] = nz;
      v[vi++] = uFrac;
      v[vi++] = 1 - vFrac;
    }
  }

  const idx = new Uint32Array(rr * ss * 6);
  let ii = 0;
  for (let r = 0; r < rr; r++) {
    for (let s = 0; s < ss; s++) {
      const a = r * (ss + 1) + s;
      const b = a + ss + 1;
      const c = b + 1;
      const d = a + 1;

      idx[ii++] = a;
      idx[ii++] = b;
      idx[ii++] = d;
      idx[ii++] = d;
      idx[ii++] = b;
      idx[ii++] = c;
    }
  }

  return { v, idx };
};

const createOrbitOriginMarker = (gl: WebGL2RenderingContext) => {
  const { v, idx } = buildUvSphere(0.09, 10, 14);
  const mesh = createInterleavedMesh(gl, v, idx);
  const material: Material = {
    name: 'orbit-origin-marker',
    baseColorTex: null,
    baseColorFactor: [1.0, 0.5, 0.3, 0.75],
    alphaMode: 'BLEND',
  };

  return { mesh, material };
};

const destroyAllEntities = (registry: Registry) => {
  const ids: number[] = [];
  for (const e of registry.all()) ids.push(e.id);

  for (const id of ids) registry.deregister(id);
};

const installOrbitInput = (canvas: HTMLCanvasElement, orbit: PreviewOrbit, isActive: () => boolean) => {
  let activePointerId: number | null = null;
  let isPointerOverCanvas = false;

  const onPointerEnter = () => {
    isPointerOverCanvas = true;
  };

  const onPointerLeave = () => {
    isPointerOverCanvas = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isActive()) return;
    if (e.button !== 0 && e.button !== 2) return;

    orbit.dragging = true;
    orbit.dragButton = e.button;
    activePointerId = e.pointerId;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    e.preventDefault();

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isActive()) return;
    if (!orbit.dragging) return;
    if (activePointerId !== e.pointerId) return;
    if (orbit.dragButton === null) return;

    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    if (orbit.dragButton === 0) {
      orbit.pendingDx += dx;
      orbit.pendingDy += dy;
      return;
    }

    orbit.pendingPanDx += dx;
    orbit.pendingPanDy += dy;
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    if (!isActive()) return;
    if (!orbit.dragging) return;
    if (activePointerId !== e.pointerId) return;
    if (orbit.dragButton === null) return;

    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    if (orbit.dragButton === 0) {
      orbit.pendingDx += dx;
      orbit.pendingDy += dy;
      return;
    }

    orbit.pendingPanDx += dx;
    orbit.pendingPanDy += dy;
  };

  const onWindowPointerUp = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onWindowPointerCancel = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onWheel = (e: WheelEvent) => {
    if (!isActive()) return;
    if (!isPointerOverCanvas) return;
    e.preventDefault();
    e.stopPropagation();
    orbit.pendingWheel += e.deltaY;
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerCancel);

  return () => {
    canvas.removeEventListener('pointerenter', onPointerEnter);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);

    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerCancel);
  };
};

const buildPreviewMeshDraws = (
  gl: WebGL2RenderingContext,
  bodyScene: ReturnType<typeof buildRuntimeScene>,
  mats: Material[],
) => {
  const parts: MeshDrawPart[] = [];
  const nameToBody = new Map<string, number>();

  for (let i = 0; i < bodyScene.nodes.length; i++) nameToBody.set(bodyScene.nodes[i].name, i);

  for (const pair of bodyScene.meshNodePairs) {
    const model = bodyScene.models[pair.meshIndex];
    if (!model) continue;

    let skinInst = null as ReturnType<typeof createSkinInstance> | null;
    if (pair.skinIndex >= 0) {
      const srcSkin = bodyScene.skins[pair.skinIndex];
      if (!srcSkin) continue;

      const remappedJoints: number[] = [];
      for (const jNode of srcSkin.joints) {
        const jName = bodyScene.nodes[jNode]?.name;
        remappedJoints.push(jName ? (nameToBody.get(jName) ?? 0) : 0);
      }

      const fakeScene = { ...bodyScene, nodes: bodyScene.nodes, skins: [{ ...srcSkin, joints: remappedJoints }] } as ReturnType<typeof buildRuntimeScene>;
      skinInst = createSkinInstance(fakeScene, 0, pair.nodeIndex);
    }

    for (const prim of model.primitives) {
      const material = prim.materialIndex >= 0 && prim.materialIndex < mats.length
        ? mats[prim.materialIndex]
        : mats[0];

      if (prim.kind === 'skinned' && skinInst) {
        const mesh = createSkinnedMesh(gl, prim.vertices, prim.joints, prim.weights, prim.indices, skinInst.jointCount);
        parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex, skin: skinInst });
        continue;
      }

      const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
      parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex });
    }
  }

  return createMeshDraws(parts);
};

export const createPreviewSession = (canvas: HTMLCanvasElement): PreviewSession => {
  const game = useGame();
  const gameRegistry = game.registry;
  const scene = useScene();
  const sceneRegistry = scene.registry;

  let activeSceneRegistry: Registry = sceneRegistry;
  let active = false;

  const pipeline = installRenderPipeline(gameRegistry, canvas, {
    getEntityRegistry: () => activeSceneRegistry,
  });

  const gl = pipeline.device.gl;
  const textures = createTextureCache(gl);
  const gltfCache = createGltfCache();

  const orbitEnt = sceneRegistry.createBare();
  const orbit = createPreviewOrbit();
  orbitEnt.components[PREVIEW_KEYS.orbit] = orbit;
  sceneRegistry.register(orbitEnt);

  const markerEnt = sceneRegistry.createBare();
  const markerT = createTransform();
  markerT.position[0] = orbit.target[0];
  markerT.position[1] = orbit.target[1];
  markerT.position[2] = orbit.target[2];
  markerT.dirty = true;
  const marker = createPreviewOrbitOriginMarker();
  let markerMesh = createOrbitOriginMarker(gl);
  markerEnt.components[COMPONENT_KEYS.transform] = markerT;
  markerEnt.components[PREVIEW_KEYS.orbitOriginMarker] = marker;
  markerEnt.components[COMPONENT_KEYS.renderable] = { mesh: markerMesh.mesh, material: markerMesh.material };
  markerEnt.onDeregister.push(() => destroyMesh(gl, markerMesh.mesh));
  sceneRegistry.register(markerEnt);

  const animEnt = sceneRegistry.createBare();
  const previewAnim = createPreviewAnim();
  animEnt.components[PREVIEW_KEYS.previewAnim] = previewAnim;
  sceneRegistry.register(animEnt);

  const removeOrbitSystem = installPreviewOrbitSystem(sceneRegistry, pipeline);
  installCharacterStateSystem(sceneRegistry);

  const removeOrbitInput = installOrbitInput(canvas, orbit, () => active);

  let loadedModelUrl: string | null = null;
  let loadedModelBoneNames: string[] = [];
  let currentClipsByName = new Map<string, ReturnType<typeof buildRetargetedClips>[number]>();
  let characterEntityId: number | null = null;
  let removeSkeletalSystem: (() => void) | null = null;
  let removeStaticModelSystem: (() => void) | null = null;
  let loadGeneration = 0;
  let activeMaterials: Material[] = [];
  let textureVariants: PreviewTextureVariant[] = [];
  let activeTextureVariantUrl: string | null = null;
  let defaultBaseColorTex: WebGLTexture | null = null;
  const ground = createGroundMesh(gl);

  const ensureGround = () => {
    pipeline.setGround(ground);
  };

  ensureGround();

  const setActive = (next: boolean) => {
    active = next;
    activeSceneRegistry = next ? sceneRegistry : sceneRegistry;

    game.setActiveScene(next ? scene : null);
  };

  const unload = () => {
    loadedModelUrl = null;
    loadedModelBoneNames = [];
    currentClipsByName = new Map();
    characterEntityId = null;
    activeMaterials = [];
    textureVariants = [];
    activeTextureVariantUrl = null;
    defaultBaseColorTex = null;

    if (removeSkeletalSystem) {
      removeSkeletalSystem();
      removeSkeletalSystem = null;
    }

    if (removeStaticModelSystem) {
      removeStaticModelSystem();
      removeStaticModelSystem = null;
    }

    pipeline.clearGround();
    destroyAllEntities(sceneRegistry);

    markerMesh = createOrbitOriginMarker(gl);

    const orbitE = sceneRegistry.createBare();
    orbitE.components[PREVIEW_KEYS.orbit] = orbit;
    sceneRegistry.register(orbitE);

    const markerE = sceneRegistry.createBare();
    markerE.components[COMPONENT_KEYS.transform] = markerT;
    markerE.components[PREVIEW_KEYS.orbitOriginMarker] = marker;
    markerE.components[COMPONENT_KEYS.renderable] = { mesh: markerMesh.mesh, material: markerMesh.material };
    markerE.onDeregister.push(() => destroyMesh(gl, markerMesh.mesh));
    sceneRegistry.register(markerE);

    const animE = sceneRegistry.createBare();
    animE.components[PREVIEW_KEYS.previewAnim] = previewAnim;
    sceneRegistry.register(animE);

    ensureGround();
  };

  const applyTextureToMaterials = (tex: WebGLTexture | null) => {
    for (const mat of activeMaterials) {
      if (tex) mat.baseColorTex = tex;
    }
  };

  const loadModel = async (
    modelUrl: string,
    nextVariants: PreviewTextureVariant[] = [],
  ): Promise<PreviewLoadedModel> => {
    const generation = ++loadGeneration;

    unload();

    loadedModelUrl = modelUrl;
    textureVariants = nextVariants;
    activeTextureVariantUrl = null;

    const loaded = await gltfCache.getOrLoad(modelUrl);
    if (generation !== loadGeneration) {
      return {
        kind: 'StaticProp',
        modelUrl,
        boneNames: [],
        textureVariants: nextVariants,
        activeTextureVariantUrl: null,
      };
    }

    const runtimeScene = buildRuntimeScene(loaded);
    const mats = buildGltfMaterials(loaded, 'preview', textures);
    activeMaterials = mats;
    defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

    const hasSkin = runtimeScene.skins.length > 0;

    const rootT = createTransform();
    rootT.dirty = true;
    const bounds = createEmptyBounds();

    for (const pair of runtimeScene.meshNodePairs) {
      const model = runtimeScene.models[pair.meshIndex];
      if (!model) continue;

      const nodeWorld = runtimeScene.nodes[pair.nodeIndex]?.worldM;

      for (const prim of model.primitives) {
        expandBoundsFromInterleaved(bounds, prim.vertices, nodeWorld);
      }
    }

    if (isBoundsValid(bounds)) {
      const center = boundsCenter(bounds);

      rootT.position[0] = -center[0];
      rootT.position[1] = -center[1];
      rootT.position[2] = -center[2];
      rootT.dirty = true;

      frameOrbitOnBounds(orbit, [0, 0, 0], boundsRadius(bounds));
    }

    if (hasSkin) {
      const cc = createCharacterController();

      const entity = sceneRegistry.createBare();
      entity.components[COMPONENT_KEYS.transform] = rootT;
      entity.components[COMPONENT_KEYS.character] = cc;

      const emptyClip = (name: string) => ({ name, duration: 1, channels: [] });
      const wrapped = createAnimationClip(emptyClip('idle'));

      const meshDraws = buildPreviewMeshDraws(gl, runtimeScene, mats);
      for (const part of meshDraws.parts) {
        entity.onDeregister.push(() => destroyMesh(gl, part.mesh));
      }

      entity.components[COMPONENT_KEYS.skeletalModel] = createSkeletalModel(runtimeScene, 0);
      entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;
      entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap({
        idle: wrapped,
        run: wrapped,
        jumpStart: wrapped,
        jumpAir: wrapped,
        jumpLand: wrapped,
      });
      entity.components[COMPONENT_KEYS.animationStateMachine] = createAnimationStateMachine();
      sceneRegistry.register(entity);
      characterEntityId = entity.id;

      if (removeSkeletalSystem) removeSkeletalSystem();
      removeSkeletalSystem = installSkeletalCharacterSystems(sceneRegistry);

      loadedModelBoneNames = runtimeScene.skins[0]?.joints
        .map((j) => runtimeScene.nodes[j]?.name ?? '')
        .filter((n) => n.length > 0) ?? [];

      return {
        kind: 'CharacterModel',
        modelUrl,
        boneNames: loadedModelBoneNames,
        textureVariants: nextVariants,
        activeTextureVariantUrl,
      };
    }

    const renderEntityIds: number[] = [];

    for (const pair of runtimeScene.meshNodePairs) {
      const model = runtimeScene.models[pair.meshIndex];
      if (!model) continue;

      for (const prim of model.primitives) {
        const material = prim.materialIndex >= 0 && prim.materialIndex < mats.length ? mats[prim.materialIndex] : mats[0];

        if (prim.kind === 'skinned' && pair.skinIndex >= 0) continue;

        const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
        const re = sceneRegistry.createBare();
        re.components[COMPONENT_KEYS.transform] = rootT;
        re.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
        re.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
        re.onDeregister.push(() => destroyMesh(gl, mesh));
        sceneRegistry.register(re);
        renderEntityIds.push(re.id);
      }
    }

    const propRoot = sceneRegistry.createBare();
    propRoot.components[COMPONENT_KEYS.transform] = rootT;
    propRoot.components[COMPONENT_KEYS.staticModel] = createStaticModel(runtimeScene);
    propRoot.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
    sceneRegistry.register(propRoot);

    if (removeStaticModelSystem) removeStaticModelSystem();
    removeStaticModelSystem = installStaticModelSystem(sceneRegistry);

    return {
      kind: 'StaticProp',
      modelUrl,
      boneNames: [],
      textureVariants: nextVariants,
      activeTextureVariantUrl,
    };
  };

  const loadAnimationPack = async (packUrl: string): Promise<PreviewLoadedAnimationPack> => {
    if (!loadedModelUrl) return { packUrl, clipNames: [] };

    const entity = characterEntityId ? sceneRegistry.get(characterEntityId) : undefined;
    const model = entity?.components[COMPONENT_KEYS.skeletalModel] as { bodyScene: ReturnType<typeof buildRuntimeScene> } | undefined;
    if (!model) return { packUrl, clipNames: [] };

    const loadedAnim = await gltfCache.getOrLoad(packUrl);
    const clips = buildRetargetedClips(loadedAnim, model.bodyScene.nodes);

    currentClipsByName = new Map(clips.map((c) => [c.name, c]));

    const anim = (sceneRegistry.view(PREVIEW_KEYS.previewAnim)[0]?.components[PREVIEW_KEYS.previewAnim] ?? null) as PreviewAnim | null;
    if (anim) {
      anim.selectedAnimUrl = packUrl;
      anim.availableClipNames = clips.map((c) => c.name);
      if (!anim.selectedClipName || !currentClipsByName.has(anim.selectedClipName)) {
        anim.selectedClipName = clips[0]?.name ?? null;
      }
    }

    return { packUrl, clipNames: clips.map((c) => c.name) };
  };

  const applyClip = (clipName: string) => {
    const entity = characterEntityId ? sceneRegistry.get(characterEntityId) : undefined;
    if (!entity) return;

    const clip = currentClipsByName.get(clipName);
    if (!clip) return;

    const wrapped = createAnimationClip(clip);
    const clipMap = entity.components[COMPONENT_KEYS.animationClipMap] as ReturnType<typeof createAnimationClipMap> | undefined;
    if (clipMap) {
      const states = ['idle', 'run', 'jumpStart', 'jumpAir', 'jumpLand'] as const;
      for (const state of states) clipMap.clips[state] = wrapped;
    }

    const fsm = entity.components[COMPONENT_KEYS.animationStateMachine] as ReturnType<typeof createAnimationStateMachine> | undefined;
    if (fsm) {
      fsm.current = 'idle';
      fsm.stateTime = 0;
      fsm.animTime = 0;
    }

    const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController> | undefined;
    if (cc) {
      cc.velocity[0] = 0;
      cc.velocity[2] = 0;
    }

    const anim = (sceneRegistry.view(PREVIEW_KEYS.previewAnim)[0]?.components[PREVIEW_KEYS.previewAnim] ?? null) as PreviewAnim | null;
    if (anim) anim.selectedClipName = clipName;
  };

  const setTextureVariant = async (variantUrl: string | null) => {
    if (!loadedModelUrl) return;
    if (activeMaterials.length === 0) return;

    if (!variantUrl) {
      activeTextureVariantUrl = null;
      applyTextureToMaterials(defaultBaseColorTex);
      return;
    }

    const tex = await textures.getOrLoad(variantUrl);
    activeTextureVariantUrl = variantUrl;
    applyTextureToMaterials(tex);
  };

  game.start();

  return {
    canvas,
    gameRegistry,
    sceneRegistry,
    pipeline,
    textures,
    gltfCache,
    setActive,
    loadModel,
    loadAnimationPack,
    applyClip,
    setTextureVariant,
    unload: () => {
      removeOrbitInput();
      removeOrbitSystem();
      game.stop();
      game.setActiveScene(null);
      pipeline.destroy();
      unload();
    },
  };
};
