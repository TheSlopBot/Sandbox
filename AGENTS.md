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
| `createX()` | Factory that builds an entity/object and returns it |
| `installXSystem(registry, ...)` | Side-effectful system wiring; registers `addAction` callbacks |
| `buildX()` | Pure data transformation (no GL calls, no registry writes) |
| `useX()` | Registry-level singleton (engine-layer only) |

**Movement** is the canonical term for anything that can move: `movementIntent`, `movementBlend`, `movementAnimTime`. Do not use `locomotion*`.

---

## Module layout

```
viberanium/src/
  engine/       core loop, registry, entity
  math/         vec3, mat4, quat
  input/        createInput
  collision/    aabb, obb — pure math only
  components/   shared + character component types
  systems/      install*System processors
  navigation/   A* pathfinding helpers
  assets/       loaders (gltf/)
  render/       pipeline, passes, shaders, gl/
  index.ts      package public API (barrel — only permitted index.ts)

sandbox/src/
  player/       feature slice: player.ts
  robot/        feature slice: robot.ts, robot AI system
  world/        ground, staticProps (calls markNavGridDirty on collider add)
  startup/      bootstrap (composition root only)
  scenes/       scene registry, nav grid entity, load/unload
```

Feature code lives in its own slice folder under the game package. Do not add logic to `startup/bootstrap.ts` beyond composition wiring.

### Scene nav grid

Each playable scene owns one `navGrid` entity on its registry. `installNavGridSystem` rebuilds `blocked` cells only when `navGrid.dirty` is true. Call `markNavGridDirty(registry)` after adding or removing static colliders — never rebuild the grid every frame from AI systems.

---

## File system notes

When creating new files under `sandbox/src/player/` (or any game subdirectory), use the Shell tool with `Set-Content` if the Write tool does not produce the file on disk — Cursor's virtual FS may not flush new files in this path automatically.
