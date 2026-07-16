# AGENTS.md

Agent instructions for the Sandbox monorepo. Rules here are enforced on **every** file an agent touches.

---

## TypeScript: non-negotiables

### No `function` keyword
All callables are `const` arrow functions — no exceptions including module-level helpers, event handlers, and nested callbacks.

```ts
// BAD
export function createInput() {}
function helper(x: number) {}

// GOOD
export const createInput = () => {};
const helper = (x: number) => {};
```

### No `class`
Factories return plain objects. Render-pass *classes* are the only permitted exception (they are GPU resource holders, not game-logic objects).

### No `any`
Use `unknown` and narrow, or use a concrete interface/type. Never cast to `any`.

### No comments in agent-generated code
Code must be self-documenting through names and types. Do not add `//` inline comments or `/** */` JSDoc blocks to `.ts` source files. Rule files (`.mdc`, `.md`) and WGSL strings are exempt.

### Arrow function style
- Single-expression bodies: one-line, no braces — `const double = (x: number) => x * 2`.
- Multi-statement bodies: block body with a blank line between each logical step (no other blank lines).

---

## Naming

| Pattern | Use for |
|---------|---------|
| `createX()` | Factory that builds a component/object and returns it |
| `installXSystem(registry, ...)` | Side-effectful system wiring; registers `addAction` callbacks |
| `buildX()` | Pure data transformation (no GL calls, no registry writes) |
| `loadX()` | Resolve assets to typed data — no registry writes |
| `spawnX()` | Wire loaded data onto entities and register |
| `useX()` | Registry-level singleton (engine-layer only) |
| `swapX()` | Runtime replacement of model, clip, or material on an existing entity |

**Movement** is the canonical term for character intent: `movementIntent`. Animation state and clip maps live on `animationStateMachine` and `animationClipMap` — not on `character`. `character` is physics only: `velocity`, `onGround`, `sliding`, `groundNormal`, jump coyote/buffer. Never use `locomotion` in names or docs.

### Character collision

- CPU path: `installCharacterPhysicsSystem` + `resolveCylinderMoveAndSlide` in `viberanium/collision/`
- Body cylinder from authored `collider` on character entity — not from `character` fields
- No `ramp` type — rotated box colliders; slope behavior is angle-based (walk ≤ 50°, slide 50°–80°, wall > 80° with defaults)
- Slope slide (`character.sliding`) suppresses input and applies downhill velocity; wall slide is transient velocity projection during resolve
- Sandbox installs CPU collision only — not `installCollisionSystem` (optional GPU alternate)

---

## Module layout

```
viberanium/src/
  engine/       core loop, registry, entity
  math/         vec3, mat4, quat
  input/        createInput
  collision/    characterContact, characterCollision, broadphase — pure math, no registry
  components/   shared component types (hierarchy, meshDraws, animation, …)
  systems/      install*System processors
  navigation/   A* pathfinding helpers
  assets/       loaders (gltf/)
  definitions/  portable Actor/Prop/Skeletal/Level defs + pure helpers (no app coupling)
  spawn/        instantiateProp and related engine spawn helpers
  render/       WebGPU pipeline, passes, WGSL shaders, gl/ device helpers
  index.ts      package public API (barrel — only permitted index.ts)

sandbox/src/
  catalog/      assets, animations, characters, props, levels, keys, ui
  entities/     actor/, player/, enemies/, ground/
  scenes/common/  createPlayableScene, useLevelScene, prop re-export
  storage/      levelLocalStore (shared with construct)
  globals/      bootstrap, sceneManager
  menus/        performance, levels
  ui/           app/SandboxApp, theme/style.css

construct/src/
  catalog/      props, actors, levels documents + manifest
  entities/     propEditor, actorEditor, levelEditor, gizmos, orbit
  session/      preview, propEditor, actorEditor, levelEditor
  storage/      prop/actor/level localStore
  ui/           ConstructApp + explorer/inspector/modals
```

Feature code lives in its own slice folder under `entities/`. Do not add logic to `globals/bootstrap.ts` beyond composition wiring.

### Catalog vs entities vs definitions

- **viberanium/definitions/** — portable `ActorDefinition`, `PropDefinition`, `SkeletalCharacterDef`, `LevelDefinition`, pure converters/builders/URL collectors. No Kaykit, no `aiPackage`, no spawn, no document parse.
- **viberanium/spawn/** — `instantiateProp` and related engine spawn (no gameplay extras).
- **sandbox catalog/** — app resource registries (URLs, Kaykit packs, `GameActorDefinition` with `aiPackage`, level seeds / `levelFile` parse). No registry writes.
- **construct catalog/** — `PropDocument` / `ActorDocument` / `LevelDocument` parse/serialize and converters to portable defs.
- **entities/** — factories (`createPlayer`, `spawnActor`), components, systems; Construct `levelEditor` placements are editor-only (no `testAi`).
- **scenes/common/** — level plumbing (`useLevelScene`, `createPlayableScene`); prop spawn via engine `instantiateProp`.

See `.cursor/rules/sandbox-structure.mdc` and `.cursor/rules/construct-structure.mdc` for full layout contracts.

### Skeletal characters

1. Define assets via `ActorDefinition` / `SkeletalCharacterDef` (engine types; sandbox kaykit wrappers in `catalog/`)
2. `loadSkeletalCharacter(deps, def)` in `entities/actor/` — returns model, meshDraws, clips, attachment data
3. `spawnSkeletalCharacter(registry, entity, loaded)` — components + hierarchy children
4. Game factory adds gameplay components, then `registry.register(entity)`

GPU pose LOD must not skip until the first joint-palette write. Scene owners call the `installSkeletalCharacterSystems` disposer on `unload`.

### Levels & assets

- Portable shape: indexed `LevelDefinition` in viberanium (`simpleProps` / `standardProps` / `simpleActors` / `standardActors` + props/actors/colliders composition + `playerSpawn` + `groundPlane`)
- Authoring: Construct `LevelDocument` (`.level`) with groups + `aiPackage` + player spawn + ground plane; shared localStorage key `construct.levelLocalStore`
- Sandbox: seed store on boot; main menu Load Level opens level modal; Digit1–4 load testOne–testFour; each `switchTo` creates a fresh scene
- Preload via `collectUrlsFromLevel` (index only)
- `scene.load()` creates level content; `scene.unload()` disposes skeletal systems then deregisters everything on the scene registry

See `.cursor/rules/levels.mdc`, `.cursor/rules/sandbox-structure.mdc`, and `.cursor/rules/ecs.mdc` for full patterns.

---

## File system notes

When creating new files under `sandbox/src/entities/` (or any game subdirectory), use the Shell tool with `Set-Content` if the Write tool does not produce the file on disk — Cursor's virtual FS may not flush new files in this path automatically.
