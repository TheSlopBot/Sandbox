import {
  type GltfCache,
  type LocalTransform,
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
  installTransformHierarchySystem,
  installColliderTransformSystem,
  m4,
  useGame,
  useScene,
  COMPONENT_KEYS,
  type MeshDrawPart,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import { createConstructOrbit, frameOrbitOnBounds, type ConstructOrbit } from '../entities/orbit/components/orbit.ts';
import { createConstructOrbitOriginMarker } from '../entities/orbit/components/orbitOriginMarker.ts';
import { createConstructAnim, type ConstructAnim } from '../entities/orbit/components/constructAnim.ts';
import { installConstructOrbitSystem } from '../entities/orbit/systems/orbitSystem.ts';
import {
  clearPropEditorEntities,
  defaultColliderPart,
  ensurePropRoot,
  removePropPartEntity,
  spawnAssetPartEntity,
  spawnColliderPartEntity,
} from '../entities/propEditor/spawnPropEditor.ts';
import { installConstructGizmoSystem } from '../entities/propEditor/systems/gizmoSystem.ts';
import { syncPartLocalToWorld } from '../entities/propEditor/syncPartLocal.ts';
import {
  type PropDocument,
  type PropDocumentAssetPart,
  type PropEditorTransformMode,
  createEmptyPropDocument,
  identityPartLocal,
} from '../catalog/props/propDocument.ts';
import { createConstructGizmoMode } from '../entities/propEditor/components/gizmoMode.ts';
import { createConstructPropSelection } from '../entities/propEditor/components/propSelection.ts';
import { type ConstructPropPart } from '../entities/propEditor/components/propPart.ts';
import {
  boundsCenter,
  boundsRadius,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from '../entities/viewer/modelBounds.ts';
import { createGroundMesh } from '../scenes/common/ground.ts';

export type ConstructTextureVariant = {
  label: string;
  url: string;
};

export type ConstructSession = {
  canvas: HTMLCanvasElement;
  gameRegistry: Registry;
  sceneRegistry: Registry;
  pipeline: RenderPipeline;
  textures: TextureCache;
  gltfCache: GltfCache;
  setActive: (active: boolean) => void;
  loadModel: (modelUrl: string, textureVariants?: ConstructTextureVariant[]) => Promise<ConstructLoadedModel>;
  loadAnimationPack: (packUrl: string) => Promise<ConstructLoadedAnimationPack>;
  applyClip: (clipName: string) => void;
  setTextureVariant: (variantUrl: string | null) => Promise<void>;
  newProp: () => PropDocument;
  enterPropMode: () => Promise<PropDocument>;
  getPropDocument: () => PropDocument;
  loadPropDocument: (doc: PropDocument) => Promise<PropDocument>;
  addAssetPart: (url: string, materialPrefix?: string) => Promise<PropDocument>;
  addColliderPart: (shape: 'box' | 'cylinder' | 'sphere') => PropDocument;
  selectPart: (partId: string | null) => void;
  setTransformMode: (mode: PropEditorTransformMode) => void;
  updatePartName: (partId: string, name: string) => PropDocument;
  updatePartLocal: (
    partId: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ) => PropDocument;
  removePart: (partId: string) => PropDocument;
  setPropDocumentListener: (fn: ((doc: PropDocument) => void) | null) => void;
  getOrbitAngles: () => { yawRad: number; pitchRad: number };
  unload: () => void;
};

export type ConstructLoadedModel = {
  kind: 'StaticProp' | 'CharacterModel';
  modelUrl: string;
  boneNames: string[];
  textureVariants: ConstructTextureVariant[];
  activeTextureVariantUrl: string | null;
};

export type ConstructLoadedAnimationPack = {
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

const installOrbitInput = (canvas: HTMLCanvasElement, orbit: ConstructOrbit, isActive: () => boolean) => {
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
    if (e.button !== 1 && e.button !== 2) return;

    orbit.dragging = true;
    orbit.dragButton = e.button as 1 | 2;
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

    if (orbit.dragButton === 1) {
      orbit.pendingDx += dx;
      orbit.pendingDy += dy;
      return;
    }

    orbit.pendingPanDx += dx;
    orbit.pendingPanDy += dy;
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    onPointerMove(e);
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
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);

    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerCancel);
  };
};

const buildConstructMeshDraws = (
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

export const bootstrap = (canvas: HTMLCanvasElement): ConstructSession => {
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
  const orbit = createConstructOrbit();
  orbitEnt.components[CONSTRUCT_KEYS.orbit] = orbit;
  sceneRegistry.register(orbitEnt);

  const markerEnt = sceneRegistry.createBare();
  const markerT = createTransform();
  markerT.position[0] = orbit.target[0];
  markerT.position[1] = orbit.target[1];
  markerT.position[2] = orbit.target[2];
  markerT.dirty = true;
  const marker = createConstructOrbitOriginMarker();
  let markerMesh = createOrbitOriginMarker(gl);
  markerEnt.components[COMPONENT_KEYS.transform] = markerT;
  markerEnt.components[CONSTRUCT_KEYS.orbitOriginMarker] = marker;
  markerEnt.components[COMPONENT_KEYS.renderable] = { mesh: markerMesh.mesh, material: markerMesh.material };
  markerEnt.onDeregister.push(() => destroyMesh(gl, markerMesh.mesh));
  sceneRegistry.register(markerEnt);

  const animEnt = sceneRegistry.createBare();
  const constructAnim = createConstructAnim();
  animEnt.components[CONSTRUCT_KEYS.constructAnim] = constructAnim;
  sceneRegistry.register(animEnt);

  const removeOrbitSystem = installConstructOrbitSystem(sceneRegistry, pipeline);
  installCharacterStateSystem(sceneRegistry);
  installTransformHierarchySystem(sceneRegistry);
  installColliderTransformSystem(sceneRegistry);

  let propDocument: PropDocument = createEmptyPropDocument();
  let propDocListener: ((doc: PropDocument) => void) | null = null;
  let gizmoDragging = () => false;

  const removeOrbitInput = installOrbitInput(canvas, orbit, () => active && !gizmoDragging());

  const gizmoController = installConstructGizmoSystem(
    gl,
    sceneRegistry,
    pipeline,
    canvas,
    () => propDocument,
    (doc) => {
      propDocument = doc;
      propDocListener?.(doc);
    },
    () => active,
  );
  gizmoDragging = () => gizmoController.isDragging();

  let partCounter = 0;
  let selectionEnt = sceneRegistry.createBare();
  selectionEnt.components[CONSTRUCT_KEYS.propSelection] = createConstructPropSelection();
  selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] = createConstructGizmoMode('move');
  sceneRegistry.register(selectionEnt);

  const ensureSelectionEntity = () => {
    if (sceneRegistry.get(selectionEnt.id)) return;
    selectionEnt = sceneRegistry.createBare();
    selectionEnt.components[CONSTRUCT_KEYS.propSelection] = createConstructPropSelection();
    selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] = createConstructGizmoMode('move');
    sceneRegistry.register(selectionEnt);
  };

  let loadedModelUrl: string | null = null;
  let loadedModelBoneNames: string[] = [];
  let currentClipsByName = new Map<string, ReturnType<typeof buildRetargetedClips>[number]>();
  let characterEntityId: number | null = null;
  let removeSkeletalSystem: (() => void) | null = null;
  let removeStaticModelSystem: (() => void) | null = null;
  let loadGeneration = 0;
  let activeMaterials: Material[] = [];
  let textureVariants: ConstructTextureVariant[] = [];
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
    orbitE.components[CONSTRUCT_KEYS.orbit] = orbit;
    sceneRegistry.register(orbitE);

    const markerE = sceneRegistry.createBare();
    markerE.components[COMPONENT_KEYS.transform] = markerT;
    markerE.components[CONSTRUCT_KEYS.orbitOriginMarker] = marker;
    markerE.components[COMPONENT_KEYS.renderable] = { mesh: markerMesh.mesh, material: markerMesh.material };
    markerE.onDeregister.push(() => destroyMesh(gl, markerMesh.mesh));
    sceneRegistry.register(markerE);

    const animE = sceneRegistry.createBare();
    animE.components[CONSTRUCT_KEYS.constructAnim] = constructAnim;
    sceneRegistry.register(animE);

    ensureSelectionEntity();
    ensureGround();
  };

  const applyTextureToMaterials = (tex: WebGLTexture | null) => {
    for (const mat of activeMaterials) {
      if (tex) mat.baseColorTex = tex;
    }
  };

  const loadModel = async (
    modelUrl: string,
    nextVariants: ConstructTextureVariant[] = [],
  ): Promise<ConstructLoadedModel> => {
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
    const mats = buildGltfMaterials(loaded, 'construct', textures);
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

      const meshDraws = buildConstructMeshDraws(gl, runtimeScene, mats);
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

  const loadAnimationPack = async (packUrl: string): Promise<ConstructLoadedAnimationPack> => {
    if (!loadedModelUrl) return { packUrl, clipNames: [] };

    const entity = characterEntityId ? sceneRegistry.get(characterEntityId) : undefined;
    const model = entity?.components[COMPONENT_KEYS.skeletalModel] as { bodyScene: ReturnType<typeof buildRuntimeScene> } | undefined;
    if (!model) return { packUrl, clipNames: [] };

    const loadedAnim = await gltfCache.getOrLoad(packUrl);
    const clips = buildRetargetedClips(loadedAnim, model.bodyScene.nodes);

    currentClipsByName = new Map(clips.map((c) => [c.name, c]));

    const anim = (sceneRegistry.view(CONSTRUCT_KEYS.constructAnim)[0]?.components[CONSTRUCT_KEYS.constructAnim] ?? null) as ConstructAnim | null;
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

    const anim = (sceneRegistry.view(CONSTRUCT_KEYS.constructAnim)[0]?.components[CONSTRUCT_KEYS.constructAnim] ?? null) as ConstructAnim | null;
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

  const newProp = (): PropDocument => {
    unload();
    clearPropEditorEntities(sceneRegistry);
    propDocument = createEmptyPropDocument();
    partCounter = 0;
    ensurePropRoot(sceneRegistry, propDocument);
    ensureSelectionEntity();
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    sel.partId = null;
    return propDocument;
  };

  const enterPropMode = async (): Promise<PropDocument> => {
    unload();
    clearPropEditorEntities(sceneRegistry);
    ensureSelectionEntity();
    const rootId = ensurePropRoot(sceneRegistry, propDocument);
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    sel.partId = null;

    if (!removeStaticModelSystem) removeStaticModelSystem = installStaticModelSystem(sceneRegistry);

    for (const part of propDocument.parts) {
      if (part.kind === 'collider') {
        spawnColliderPartEntity(gl, sceneRegistry, rootId, part);
      } else {
        await spawnAssetPartEntity(gl, sceneRegistry, textures, gltfCache, rootId, part);
      }
    }

    return propDocument;
  };

  const getPropDocument = (): PropDocument => propDocument;

  const loadPropDocument = async (doc: PropDocument): Promise<PropDocument> => {
    unload();
    clearPropEditorEntities(sceneRegistry);
    propDocument = {
      version: 1,
      id: doc.id,
      displayName: doc.displayName,
      parts: doc.parts.map((part) => ({
        ...part,
        name: part.name?.trim() ? part.name : part.id,
      })),
    };
    partCounter = propDocument.parts.length;
    const rootId = ensurePropRoot(sceneRegistry, propDocument);
    ensureSelectionEntity();

    if (!removeStaticModelSystem) removeStaticModelSystem = installStaticModelSystem(sceneRegistry);

    for (const part of propDocument.parts) {
      if (part.kind === 'collider') {
        spawnColliderPartEntity(gl, sceneRegistry, rootId, part);
      } else {
        await spawnAssetPartEntity(gl, sceneRegistry, textures, gltfCache, rootId, part);
      }
    }

    return propDocument;
  };

  const addAssetPart = async (url: string, materialPrefix = 'prop'): Promise<PropDocument> => {
    const rootId = ensurePropRoot(sceneRegistry, propDocument);
    partCounter += 1;
    const local = identityPartLocal();
    const part: PropDocumentAssetPart = {
      id: `mesh_${partCounter}`,
      name: `mesh_${partCounter}`,
      kind: 'asset',
      url,
      materialPrefix,
      ...local,
    };
    propDocument = { ...propDocument, parts: [...propDocument.parts, part] };

    if (!removeStaticModelSystem) removeStaticModelSystem = installStaticModelSystem(sceneRegistry);
    await spawnAssetPartEntity(gl, sceneRegistry, textures, gltfCache, rootId, part);

    ensureSelectionEntity();
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    sel.partId = part.id;
    return propDocument;
  };

  const addColliderPart = (shape: 'box' | 'cylinder' | 'sphere'): PropDocument => {
    const rootId = ensurePropRoot(sceneRegistry, propDocument);
    partCounter += 1;
    const part = defaultColliderPart(shape, `col_${partCounter}`);
    propDocument = { ...propDocument, parts: [...propDocument.parts, part] };
    spawnColliderPartEntity(gl, sceneRegistry, rootId, part);

    ensureSelectionEntity();
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    sel.partId = part.id;
    return propDocument;
  };

  const selectPart = (partId: string | null) => {
    ensureSelectionEntity();
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    sel.partId = partId;
  };

  const setTransformMode = (mode: PropEditorTransformMode) => {
    ensureSelectionEntity();
    const gizmo = selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ReturnType<typeof createConstructGizmoMode>;
    gizmo.mode = mode;
  };

  const findPartEntity = (partId: string) => {
    for (const e of sceneRegistry.view(CONSTRUCT_KEYS.propPart)) {
      const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
      if (part?.partId === partId) return e;
    }
    return null;
  };

  const notifyPropDoc = () => {
    propDocListener?.(propDocument);
  };

  const updatePartName = (partId: string, name: string): PropDocument => {
    const trimmed = name.trim();
    if (!trimmed) return propDocument;

    propDocument = {
      ...propDocument,
      parts: propDocument.parts.map((part) =>
        part.id === partId ? { ...part, name: trimmed } : part,
      ),
    };
    notifyPropDoc();
    return propDocument;
  };

  const updatePartLocal = (
    partId: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ): PropDocument => {
    const entity = findPartEntity(partId);
    const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (!entity || !local) return propDocument;

    if (patch.position) {
      local.position[0] = patch.position[0];
      local.position[1] = patch.position[1];
      local.position[2] = patch.position[2];
    }
    if (patch.scale) {
      local.scale[0] = patch.scale[0];
      local.scale[1] = patch.scale[1];
      local.scale[2] = patch.scale[2];
    }
    if (patch.rotation) {
      local.rotation[0] = patch.rotation[0];
      local.rotation[1] = patch.rotation[1];
      local.rotation[2] = patch.rotation[2];
      local.rotation[3] = patch.rotation[3];
    }

    syncPartLocalToWorld(sceneRegistry, entity);

    propDocument = {
      ...propDocument,
      parts: propDocument.parts.map((part) => {
        if (part.id !== partId) return part;
        return {
          ...part,
          position: [local.position[0], local.position[1], local.position[2]],
          rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
          scale: [local.scale[0], local.scale[1], local.scale[2]],
        };
      }),
    };
    notifyPropDoc();
    return propDocument;
  };

  const removePart = (partId: string): PropDocument => {
    if (!propDocument.parts.some((part) => part.id === partId)) return propDocument;

    removePropPartEntity(sceneRegistry, partId);
    propDocument = {
      ...propDocument,
      parts: propDocument.parts.filter((part) => part.id !== partId),
    };

    ensureSelectionEntity();
    const sel = selectionEnt.components[CONSTRUCT_KEYS.propSelection] as ReturnType<typeof createConstructPropSelection>;
    if (sel.partId === partId) sel.partId = null;

    notifyPropDoc();
    return propDocument;
  };

  const setPropDocumentListener = (fn: ((doc: PropDocument) => void) | null) => {
    propDocListener = fn;
  };

  const getOrbitAngles = () => ({
    yawRad: orbit.yawRad,
    pitchRad: orbit.pitchRad,
  });

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
    newProp,
    enterPropMode,
    getPropDocument,
    loadPropDocument,
    addAssetPart,
    addColliderPart,
    selectPart,
    setTransformMode,
    updatePartName,
    updatePartLocal,
    removePart,
    setPropDocumentListener,
    getOrbitAngles,
    unload: () => {
      removeOrbitInput();
      removeOrbitSystem();
      gizmoController.destroy();
      game.stop();
      game.setActiveScene(null);
      pipeline.destroy();
      unload();
    },
  };
};
