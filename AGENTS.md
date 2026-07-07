# AGENTS.md

Agent instructions for the Sandbox project. Rules here are enforced on **every** file an agent touches.

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

---

## Module layout

```
src/
  engine/       core loop, registry, entity
  math/         vec3, mat4, quat
  input/        createInput
  collision/    aabb, obb — pure math only
  components/   shared component types
  assets/       loaders (gltf/, texture)
  render/       pipeline, passes, shaders, gl/
  player/       feature slice: components/, systems/, player.ts
  world/        ground, staticProps
  startup/      bootstrap (composition root only)
```

Feature code lives in its own slice folder. Do not add logic to `startup/bootstrap.ts`; it is a composition root only.

---

## File system notes

The `src/player/systems/` directory exists on disk at `src/player/systems/`. When creating new files in that directory (or any `src/player/` subdirectory), use the Shell tool with `Set-Content` if the Write tool does not produce the file on disk — Cursor''s virtual FS may not flush new files in this path automatically.
