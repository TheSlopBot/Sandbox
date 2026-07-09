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
Factories return plain objects. Render-pass *classes* are the only permitted exception (they are WebGL resource holders, not game-logic objects).

### No `any`
Use `unknown` and narrow, or use a concrete interface/type. Never cast to `any`.

### No comments in agent-generated code
Code must be self-documenting through names and types. Do not add `//` inline comments or `/** */` JSDoc blocks to `.ts` source files. Rule files (`.mdc`, `.md`) and GLSL strings are exempt.

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

**Movement** is the canonical term for character intent: `movementIntent`. Animation state and clip maps live on `animationStateMachine` and `animationClipMap` — not on `character`. Never use `locomotion` in names or docs.

---

## Module layout

```
viberanium/src/
  engine/       core loop, registry, entity
  math/         vec3, mat4, quat
  input/        createInput
  collision/    aabb, obb — pure math only
  components/   shared component types (hierarchy, meshDraws, animation, …)
  systems/      install*System processors
  navigation/   A* pathfinding helpers
  assets/       loaders (gltf/)
  render/       pipeline, passes, shaders, gl/
  index.ts      package public API (barrel — only permitted index.ts)

sandbox/src/
  character/    defs/, loadSkeletalCharacter, spawnSkeletalCharacter
  levels/       catalog, assets, useLevelScene
  startup/      bootstrap, sceneManager
  scenes/       createPlayableScene
  player/       createPlayer, playerController, attachment tags
  npcs/         robot, combatMech, test AI
  world/        ground, staticProps
```

Feature code lives in its own slice folder under the game package. Do not add logic to `startup/bootstrap.ts` beyond composition wiring.

### Skeletal characters

1. Define assets in `character/defs/*.ts`
2. `loadSkeletalCharacter(deps, def)` — returns model, meshDraws, clips, attachment data
3. `spawnSkeletalCharacter(registry, entity, loaded)` — components + hierarchy children
4. Game factory adds gameplay components, then `registry.register(entity)`

### Levels & assets

- Add levels as `LevelDefinition` entries in `sandbox/src/levels/catalog.ts`
- Preload via `collectUrlsFromDef` for each character def used in the level
- `scene.load()` creates level content; `scene.unload()` destroys everything on the scene registry

See `.cursor/rules/levels.mdc` and `.cursor/rules/ecs.mdc` for full patterns.

---

## File system notes

When creating new files under `sandbox/src/player/` (or any game subdirectory), use the Shell tool with `Set-Content` if the Write tool does not produce the file on disk — Cursor's virtual FS may not flush new files in this path automatically.
