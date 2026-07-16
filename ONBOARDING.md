# Onboarding

Mental model for the Sandbox monorepo: three packages, one shared runtime contract.

```
viberanium/   engine (portable)
sandbox/      playable game
construct/    standalone editor
```

**Import rule:** games and tools import `viberanium`. Construct never imports sandbox; sandbox never imports construct. They share portable types and the same localStorage key for `.level` files (`construct.levelLocalStore`).

---

## Mental model

### `viberanium` — the engine

Owns the ECS loop, math, input, collision math, shared components, systems, navigation, glTF loading, WebGPU render, and **portable** definition shapes.

Think of it as: *registry + systems + render + data shapes that do not know about Kaykit, AI packages, or editor UI*.

| Layer | Role |
|-------|------|
| `engine/` | `Registry`, `Game`, `Scene`, entities, frame loop |
| `components/` + `systems/` | Data + `install*System` processors |
| `definitions/` | Portable Actor / Prop / Skeletal / Level shapes (no app coupling) |
| `spawn/` | Shared spawn helpers (e.g. `instantiateProp`) |
| `render/` | WebGPU pipeline |
| `index.ts` | Public API — the only barrel `index.ts` in the repo |

### `sandbox` — the game

Owns gameplay content: catalogs, player/enemies, playable scenes, menus, bootstrap.

Think of it as: *declarative catalogs → spawn factories → ephemeral level scenes*.

| Layer | Role |
|-------|------|
| `catalog/` | URLs, character/prop defs, level seeds, keys — **no** registry writes |
| `entities/` | Factories, game components, game systems |
| `scenes/common/` | `createPlayableScene`, `useLevelScene` |
| `globals/` | Bootstrap + scene manager (composition only) |
| `menus/` + `ui/` | Overlays and React shell |

### `construct` — the editor

Owns document authoring (`.prop` / `.actor` / `.level`), explorers, inspectors, gizmos, editor sessions.

Think of it as: *documents + session mutation + editor entities*. UI talks only to `ConstructSession` / catalog helpers — never imports `entities/` from `ui/`.

| Layer | Role |
|-------|------|
| `catalog/` | Document types, parse/serialize, converters to portable defs |
| `session/` | Pure mutation slices (preview, prop, actor, level, anim) |
| `entities/` | Editor spawn, gizmos, orbit camera |
| `scenes/` | Editor scene + system installers |
| `ui/` | React shell, explorers, inspectors |

### How the three fit together

```
Construct (.level / .prop / .actor)
    │  serialize / convert
    ▼
viberanium LevelDefinition / PropDefinition / ActorDefinition
    │  used by both apps
    ├──────────────────────────┐
    ▼                          ▼
sandbox playable scene     construct editor preview
(useLevelScene + AI)       (placements, no testAi)
```

**Levels are scenes.** Every level loads as a scene; not every scene is a level. Catalog / local store is cheap and persistent; each level visit creates a **fresh** scene registry and destroys it on exit. Asset *parse* caches survive transitions; GPU meshes and entities do not.

---

## Concept priority (learn in this order)

These are the ideas you need, in order, to reason about any change. Detailed examples for each follow in the next section.

### P0 — Must understand first

1. **ECS: Entity / Component / System / Registry**
2. **Game registry vs scene registry**
3. **Naming contracts** (`createX` / `installXSystem` / `loadX` / `spawnX` / `useX` / `buildX`)
4. **Package boundaries**

### P1 — Needed for almost all gameplay / editor work

5. **Level lifecycle**
6. **Portable vs authoring level shapes**
7. **Controller pattern** (`movementIntent`)
8. **Catalog vs entities**

### P2 — Needed for characters, pathfinding, and editor depth

9. **Skeletal characters**
10. **Nav grid as scene component**
11. **Construct session model**
12. **Hierarchy components**

---

## Core concepts with examples

### 1. ECS: Entity / Component / System / Registry

**Idea:** An entity is a bag of components. Systems query the registry each frame and mutate component data. Behaviour never lives on the entity object.

| Piece | Where | Role |
|-------|-------|------|
| `Registry` | `viberanium/src/engine/registry.ts` | Owns entities + `addAction` phases |
| `Entity` | `viberanium/src/engine/entity.ts` | `{ id, components }` |
| Component keys | `viberanium/src/engine/componentKeys.ts` | Engine keys (`COMPONENT_KEYS`) |
| Game keys | `sandbox/src/catalog/keys/components.ts` | Sandbox-only tags (`GAME_COMPONENT_KEYS`) |
| Construct keys | `construct/src/catalog/keys/components.ts` | Editor-only tags (`CONSTRUCT_KEYS`) |

**Assemble an entity** (sandbox player):

```ts
// sandbox/src/entities/player/createPlayer.ts
const entity = registry.createBare();
entity.components[COMPONENT_KEYS.transform] = charT;
entity.components[COMPONENT_KEYS.character] = createCharacterController();
entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
entity.components[GAME_COMPONENT_KEYS.playerController] = createPlayerController();
// … load/spawn skeletal mesh, then:
registry.register(entity);
```

**Run a system** — query by key every frame; never cache entity refs:

```ts
// sandbox/src/entities/player/systems/playerInputSystem.ts
export const installPlayerInputSystem = (registry: Registry, input: Input, device: GpuDevice) => {
  registry.addAction('update', () => {
    for (const e of registry.view(GAME_COMPONENT_KEYS.playerController)) {
      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      // write intent.desiredVelocity / jumpRequested from keyboard
    }
  }, 5);
};
```

Shared movement then consumes that intent:

```ts
// viberanium/src/systems/movementSystem.ts
for (const e of registry.view(COMPONENT_KEYS.movementIntent)) {
  const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
  const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
  if (!cc || !intent) continue;
  cc.velocity[0] = intent.desiredVelocity[0];
  cc.velocity[2] = intent.desiredVelocity[2];
}
```

**How used:** Player input and test AI both write `movementIntent`. One movement + physics + collision stack drives every character.

---

### 2. Game registry vs scene registry

**Idea:** Persistent vs ephemeral. The frame loop runs game-registry actions first, then the active scene’s registry.

| Registry | Created in | Survives level switch? | Typical contents |
|----------|------------|------------------------|------------------|
| Game | `sandbox/src/globals/bootstrap.ts` / Construct bootstrap | Yes | Render pipeline, scene manager, global input flush |
| Scene | `useRegistry()` inside `createPlayableScene` / editor scene | No | Player, NPCs, props, ground, nav grid |

**Switching levels** installs the scene manager on the **game** registry, then replaces the active scene:

```ts
// sandbox/src/globals/sceneManager.ts — switchTo
deps.game.setActiveScene(null);                    // sync unload previous
await deps.gltfCache.preload(collectLevelAssetUrls(build.definition));
const scene = useLevelScene(sceneDeps(), build.definition, build.aiPackages);
deps.game.setActiveScene(scene);                   // new scene registry
await scene.load();
```

**Scene systems** install on the scene registry once per visit:

```ts
// sandbox/src/scenes/common/createPlayableScene.ts
const registry = useRegistry();
installPlayerInputSystem(registry, deps.input, deps.device);
installNavGridSystem(registry);
installTestAiSystem(registry);
installMovementSystem(registry);
installCharacterPhysicsSystem(registry);
// …
```

**How used:** Digit1–4 / level modal call `sceneManager.switchTo`. Digit0 only opens UI — it does not keep a scene alive across levels.

---

### 3. Naming contracts

| Pattern | Means | Example |
|---------|-------|---------|
| `createX()` | Data factory, plain object | `createMovementIntent()`, `createTransform()` |
| `installXSystem()` | Registers `addAction` on a registry | `installMovementSystem(registry)` |
| `loadX()` | Async resolve to data — **no** registry writes | `loadSkeletalCharacter(deps, def)` |
| `spawnX()` | Attach loaded data + register entities | `spawnSkeletalCharacter(registry, entity, loaded)` |
| `useX()` | Engine owns internal state | `useRegistry()`, `useGame()`, `useScene()`, `useLevelScene()` |
| `buildX()` | Pure transform / builder | `buildRetargetedClips`, `updateNavGridBlocked` |

**Concrete pipeline** (actor):

```
catalog ActorDefinition / SkeletalCharacterDef
  → loadSkeletalCharacter   (sandbox/src/entities/actor/loadSkeletalCharacter.ts)
  → spawnSkeletalCharacter  (sandbox/src/entities/actor/spawnSkeletalCharacter.ts)
  → spawnActor / createPlayer wraps both + gameplay components
```

```ts
// sandbox/src/entities/actor/spawnActor.ts
const loaded = await loadSkeletalCharacter({ device, textures, gltfCache }, def);
spawnSkeletalCharacter(registry, entity, loaded, { device });
registry.register(entity);
```

**How used:** If a function writes to a registry, it should be `spawn*` or `install*`, not `load*` or `create*`.

---

### 4. Package boundaries

| Lives in | Example | Must not contain |
|----------|---------|------------------|
| `viberanium/definitions/` | `LevelDefinition`, `PropDefinition` | Kaykit packs, `aiPackage`, document parse |
| `sandbox/catalog/` | `SPACE_RANGER_ACTOR`, level seeds | `install*System`, registry writes |
| `construct/catalog/` | `LevelDocument`, `toLevelDefinition` | Editor spawn, React |
| `viberanium/spawn/` | `instantiateProp` | `testAi`, Construct editor tags |

**Bridge example** — Construct authoring → portable runtime:

```ts
// construct/src/catalog/levels/levelDocument.ts
export const toLevelDefinition = (doc: LevelDocument): LevelDefinition => { /* … */ };
export const collectActorAiPackages = (doc: LevelDocument): Record<string, ActorAiPackage> => { /* … */ };
```

Sandbox play path parses the same `.level` JSON and strips authoring extras into a portable def + side map:

```
sandbox/src/catalog/levels/levelFile.ts   → LevelDefinition + aiPackages
sandbox/src/scenes/common/useLevelScene.ts → resolve index → instantiateProp / spawnActor
```

**How used:** Both apps can load the same `.level` file. Play adds AI; editor does not.

---

### 5. Level lifecycle

**Idea:** Documents persist; scenes do not. Preload → unload → new scene → load.

```
Digit1 → switchTo('testOne')
  → setActiveScene(null)          // unload + drop previous Scene
  → gltfCache.preload(urls)       // parse cache survives
  → useLevelScene(...)            // NEW registry + systems
  → setActiveScene(scene)
  → scene.load()                  // nav grid, ground, props, actors, player
```

**load / unload** (sandbox):

```ts
// sandbox/src/scenes/common/createPlayableScene.ts
const load = async () => {
  const navGridEntity = registry.createBare();
  navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid(navGridConfig);
  registry.register(navGridEntity);

  spawnGround(deps.device, registry, groundPlane);
  await spawnProps(addProp);
  markNavGridDirty(registry);
  if (spawnNpcs) await spawnNpcs(registry, deps);
  await createPlayer(/* … */);
};

const unload = () => {
  removeSkeletal?.();
  removeSkeletal = null;
  for (const id of [...registry.all()].map((e) => e.id)) registry.deregister(id);
  deps.staticPropBatcher.clear();
};
```

| Find | Path |
|------|------|
| Switch / Digit keys | `sandbox/src/globals/sceneManager.ts` |
| Bootstrap seed + first level | `sandbox/src/globals/bootstrap.ts` |
| Playable scene factory | `sandbox/src/scenes/common/createPlayableScene.ts` |
| Level → spawn mapping | `sandbox/src/scenes/common/useLevelScene.ts` |
| URL collection | `sandbox/src/catalog/levels/collectAssetUrls.ts` |

**How used:** Always create a fresh scene per `switchTo`. Never keep NPC or nav-grid state across levels.

---

### 6. Portable vs authoring level shapes

| Shape | Package | Extra fields |
|-------|---------|--------------|
| `LevelDefinition` | `viberanium/src/definitions/levels/levelDefinition.ts` | Indexed props/actors + composition TRS + `playerSpawn` + `groundPlane` + `navGrid` |
| `LevelDocument` | `construct/src/catalog/levels/levelDocument.ts` | `version`, instance `name`, actor `aiPackage`, `groups` |
| Parse for play | `sandbox/src/catalog/levels/levelFile.ts` | Portable def + `aiPackages` map (groups ignored at runtime) |

**Index + composition pattern** (portable):

```ts
// viberanium LevelDefinition (conceptually)
index: {
  simpleProps: Record<id, SimplePropIndex>,
  standardProps: Record<id, PropDefinition>,
  simpleActors: Record<id, ActorDefinition>,
  standardActors: Record<id, ActorDefinition>,
}
composition: {
  props: [{ id, kind, indexId, position, rotation, scale }, …],
  actors: […],
  colliders: […],
}
```

Instances reference `indexId` — assets are declared once, placed many times.

**Play resolves and spawns:**

```ts
// sandbox/src/scenes/common/useLevelScene.ts
const def = resolveLevelPropDefinition(definition, instance);
await addProp(def, { position: instance.position, rotation, scale });

const aiPackage = aiPackages[instance.id] ?? 'none';
// if 'testAi' → extraComponents[GAME_COMPONENT_KEYS.testAi] = createTestAi(…)
await spawnActor(/* … */, { extraComponents });
```

**Seeds / test levels:** `sandbox/src/catalog/levels/testOne.ts` … `testFour.ts`, registered in `levelSeed.ts` / `registry.ts`.

**How used:** Edit groups and names in Construct; runtime only needs the indexed def (+ aiPackages in sandbox).

---

### 7. Controller pattern (`movementIntent`)

**Idea:** Controllers write intent. Shared systems own movement, physics, collision, and animation.

| Writer | Component tag | File |
|--------|---------------|------|
| Player | `GAME_COMPONENT_KEYS.playerController` | `sandbox/src/entities/player/systems/playerInputSystem.ts` |
| AI | `GAME_COMPONENT_KEYS.testAi` | `sandbox/src/entities/enemies/systems/testAiSystem.ts` |
| Shared | `COMPONENT_KEYS.movementIntent` | `viberanium/src/components/movementIntent.ts` |
| Shared | movement / physics | `viberanium/src/systems/movementSystem.ts`, `characterPhysicsSystem.ts` |

```ts
// viberanium/src/components/movementIntent.ts
export type MovementIntent = {
  desiredVelocity: Vec3;
  jumpRequested: boolean;
};
```

**How used:** Adding a new enemy usually means a catalog def + `spawnActor` + optional `testAi` (or a new controller that still writes `movementIntent`). Do not fork physics.

---

### 8. Catalog vs entities

| Catalog (data) | Entities (behaviour) |
|----------------|----------------------|
| `sandbox/src/catalog/actors/kaykitActors.ts` | `sandbox/src/entities/player/createPlayer.ts` |
| `sandbox/src/catalog/characters/` | `sandbox/src/entities/actor/loadSkeletalCharacter.ts` |
| `sandbox/src/catalog/levels/testOne.ts` | `sandbox/src/scenes/common/useLevelScene.ts` |
| `construct/src/catalog/levels/levelDocument.ts` | `construct/src/entities/levelEditor/*` |

**Rule:** Catalog may import `catalog/*` and `viberanium` types. Catalog must **not** import `entities/`, `scenes/`, or `globals/`.

**How used:** When adding a prop or character, put the declarative def in catalog first; wire spawn in entities / scenes.

---

### 9. Skeletal characters

**Pipeline:**

```
ActorDefinition / SkeletalCharacterDef
  → loadSkeletalCharacter   // meshes, clips, attachments (data only)
  → spawnSkeletalCharacter  // meshDraws on root; children with boneAttachment
  → registry.register
```

| File | Role |
|------|------|
| `sandbox/src/entities/actor/loadSkeletalCharacter.ts` | Async load |
| `sandbox/src/entities/actor/spawnSkeletalCharacter.ts` | Hierarchy + components |
| `sandbox/src/entities/actor/spawnActor.ts` | Generic NPC/player-ready spawn |
| `sandbox/src/entities/player/createPlayer.ts` | Player + camera + controller |
| `sandbox/src/entities/enemies/robot/createRobot.ts` | Robot + `testAi` |

Root entity holds `skeletalModel`, `meshDraws`, `animationClipMap`, `animationStateMachine`. Attachments (helmet, blade) are **child entities**, not orphan mesh entities sharing a `Transform`.

Scene systems: `installSkeletalCharacterSystems` in `createPlayableScene` (hierarchy + FSM + GPU pose). Call the returned disposer on `unload` so the pose pass GPU buffers are freed. LOD may skip distant pose updates only after the first palette write.

**How used:** Construct actor mode authors the document; sandbox converts via `actorDefinitionToSkeletalDef` and spawns for play or level NPCs.

---

### 10. Nav grid as scene component

**Idea:** The nav grid is first-class level content — not a hidden cache inside AI.

| Piece | Where |
|-------|-------|
| Component | `viberanium/src/components/navGrid.ts` — `createNavGrid`, `markNavGridDirty` |
| Rebuild | `viberanium/src/navigation/navGrid.ts` — `updateNavGridBlocked` |
| System | `viberanium/src/systems/navGridSystem.ts` — runs when `dirty` |
| Pathfinding | `viberanium/src/navigation/astar.ts` |
| AI consumer | `sandbox/src/entities/enemies/systems/testAiSystem.ts` |

**Lifecycle:**

```ts
// created in scene.load()
navGridEntity.components[COMPONENT_KEYS.navGrid] = createNavGrid(navGridConfig);
markNavGridDirty(registry);  // after props land

// destroyed with everything else in scene.unload()
```

**How used:** After adding/removing static colliders during an active level, call `markNavGridDirty(registry)`. Do not rebuild every frame. AI reads `registry.view(COMPONENT_KEYS.navGrid)` — it does not own a `WeakMap` cache.

---

### 11. Construct session model

**Idea:** UI mutates documents through session APIs. Session slices are pure-ish document mutation; systems and spawn live under `scenes/` / `entities/`.

| Layer | Example |
|-------|---------|
| Types / state | `construct/src/session/types.ts` |
| Level mutations | `construct/src/session/levelEditor.ts` — place prop, group, gizmo commit |
| Bootstrap composition | `construct/src/globals/bootstrap.ts` → `ConstructSession` |
| React wiring | `construct/src/ui/app/useConstructSession.ts`, `useConstructInspectorActions.ts` |
| Viewport spawn | `construct/src/entities/levelEditor/spawnLevelPropPlacement.ts` |

```ts
// UI calls session — never entities/
const doc = session.removeInstances(ids);
const doc = session.createGroup(instanceIds, name);
```

Document listeners push React state; explorer/inspector re-render from the document, not from entity refs.

**How used:** To add a level-editor operation, extend `session/levelEditor.ts`, then call it from a `useConstruct*` hook. Spawn/sync in entities stays behind the session.

---

### 12. Hierarchy components

| Component | Role | Typical owner |
|-----------|------|---------------|
| `childOf` | `{ parentId }` | Child entity |
| `children` | `{ ids[] }` | Parent |
| `localTransform` | TRS relative to parent | Non-bone children |
| `boneAttachment` | Bone index + local offset | Helmet, weapons |
| `meshDraws` | GPU mesh parts | Character / prop root |
| `transform` | World pose | Every spatial entity |

Maintained at spawn/despawn; hierarchy systems update world matrices each frame (`installTransformHierarchySystem` inside skeletal installers).

**How used:** Inspect a spawned player in the debugger: root has `meshDraws` + animation components; helmet child has `boneAttachment` + `childOf`. Props from `instantiateProp` follow the same parent/child pattern for parts/colliders.

---

## Worked mini-flows

### A. “Press Digit2 → play testTwo”

1. `sceneManager` update action sees `Digit2` → `switchTo('testTwo')`
2. `resolveLevel` loads seed / local store → `LevelBuild` (`definition` + `aiPackages`)
3. Previous scene unloaded; glTF URLs preloaded
4. `useLevelScene` builds a playable scene from the indexed def
5. `load()` creates nav grid, ground, props (`instantiateProp`), actors (`spawnActor` + optional `testAi`), player (`createPlayer`)
6. Shared systems move everyone via `movementIntent`

### B. “Place a prop in Construct level mode”

1. Explorer `+` / UI hook calls session place API (`session/levelEditor.ts`)
2. Document gains an index entry (if needed) + composition instance
3. Level editor entity spawn shows the mesh in the viewport (`entities/levelEditor/`)
4. Save serializes `LevelDocument` to `.level` / local store
5. Sandbox later parses the same file and plays it without Construct

### C. “Add a new enemy kind”

1. Catalog character / actor def under `sandbox/src/catalog/`
2. Factory under `sandbox/src/entities/enemies/<kind>/` calling `spawnActor`
3. Optional AI via `GAME_COMPONENT_KEYS.testAi` (or new controller writing `movementIntent`)
4. Wire into level composition (seed or Construct place) — not into `viberanium/definitions`

---

## Reading order

Read narrowly: open the listed files (or folders) in order. Skim; do not try to memorize shaders first.

### Pass 1 — Engine core (~1–2 hours)

1. `viberanium/src/engine/` — `registry`, `game`, `scene`, `entity`
2. `viberanium/src/engine/componentKeys.ts`
3. Components: `transform`, `movementIntent`, `characterController`, `collider`
4. Collision math: `collision/characterContact.ts`, `collision/characterCollision.ts`, `collision/collisionBroadphase.ts`
5. Systems: `movementSystem`, `colliderTransformSystem`, `characterPhysicsSystem`, `characterStateSystem` (CPU path — sandbox does **not** install `collisionSystem`)
6. `viberanium/src/index.ts` — public API surface

### Pass 2 — Definitions and spawn (~30–45 min)

7. `viberanium/src/definitions/levels/levelDefinition.ts` (+ prop/actor defs nearby)
8. `viberanium/src/spawn/instantiateProp.ts`

### Pass 3 — Sandbox playable path (~1 hour)

9. `sandbox/src/globals/bootstrap.ts` + `sceneManager.ts`
10. `sandbox/src/catalog/levels/` — `levelFile.ts`, one `test*.ts`, `levelSeed.ts`
11. `sandbox/src/scenes/common/createPlayableScene.ts` + `useLevelScene.ts`
12. `sandbox/src/entities/player/` then one enemy under `entities/enemies/`
13. `sandbox/src/entities/actor/` — load/spawn pipeline

### Pass 4 — Construct authoring path (~1 hour)

14. `construct/src/globals/bootstrap.ts`
15. `construct/src/session/types.ts` then `session/levelEditor.ts`
16. `construct/src/catalog/levels/levelDocument.ts` — especially `toLevelDefinition`
17. `construct/src/scenes/editorScene.ts` (and installers)
18. `construct/src/ui/app/ConstructApp.tsx` — shell; follow `useConstructSession` + one action hook

### Pass 5 — Deeper as needed

| If you work on… | Read next |
|-----------------|-----------|
| Rendering / perf | `viberanium/src/render/pipeline.ts`, then one pass under `render/passes/` |
| Animation | `components/animation*`, skeletal systems via `installSkeletalCharacterSystems` |
| Pathfinding | `components/navGrid.ts`, `navigation/`, `systems/navGridSystem.ts`, `testAiSystem.ts` |
| Props / colliders | `instantiateProp` + Construct prop editor entities; rotated box colliders act as ramps (no dedicated ramp type) |
| Character collision | `viberanium/collision/characterCollision.ts`, `characterPhysicsSystem.ts` — slope walk/slide/wall by angle |
| Level editor UX | `ui/explorer/LevelExplorer.tsx`, `ui/inspector/Level*.tsx`, `entities/levelEditor/` |
| System order bands | `.cursor/rules/systems.mdc` |
| Rules / agents | `.cursor/rules/architecture.mdc`, `ecs.mdc`, `levels.mdc`, `AGENTS.md` |

---

## Quick orientation cheatsheet

| Question | Answer |
|----------|--------|
| Where do I put portable types? | `viberanium/definitions/` |
| Where do I put Kaykit / game catalogs? | `sandbox/catalog/` |
| Where do I put `.level` parse / editor docs? | Construct `catalog/`; sandbox `levelFile` for play |
| Where does a new enemy go? | `sandbox/entities/enemies/<kind>/` |
| Where does editor gizmo logic go? | `construct/entities/gizmos/` |
| Who writes movement? | Controllers → `movementIntent`; never fork physics per character |
| What are ramps? | Rotated box colliders — walkable ≤ 50°, slide 50°–80°, wall > 80° (defaults) |
| CPU vs GPU collision? | Sandbox uses CPU `installCharacterPhysicsSystem` only |
| May sandbox import construct? | No |
| May construct import sandbox? | No |
| Do scenes survive level switch? | No — fresh scene every `switchTo` |
| Do glTF parse caches survive? | Yes — session caches in bootstrap |
| When is the nav grid rebuilt? | Only when `navGrid.dirty` is true |

---

## Related docs

- `AGENTS.md` — coding non-negotiables for agents and humans editing code
- `.cursor/rules/architecture.mdc` — monorepo layout and contracts
- `.cursor/rules/ecs.mdc` — ECS rules in detail
- `.cursor/rules/levels.mdc` — level load / unload / asset caching
- `.cursor/rules/systems.mdc` — update/draw/commit order bands
- `.cursor/rules/sandbox-structure.mdc` / `construct-structure.mdc` — folder contracts
