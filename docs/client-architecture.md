# kooMoDraw Client Architecture

## Overview

kooMoDraw is a system design drawing tool. The client is a React + TypeScript application using a split rendering model: React manages UI chrome (header, toolbar, dialogs) while a pure TypeScript `CanvasRenderer` owns the drawing surface.

## Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| UI framework | React 19 + TypeScript | Standard component model for menus, dialogs |
| Build | Vite | Fast HMR, no config overhead |
| State | Zustand 5 | Minimal boilerplate, TypeScript-first |
| Canvas | HTML5 Canvas 2D (custom renderer) | Decoupled from React reconciler; animation-loop ready |
| Style | Plain CSS modules per component | No runtime CSS-in-JS overhead |

## Key Architectural Decisions

### Split Rendering Model

React renders the shell. The canvas is a single `<canvas>` element mounted once. `CanvasRenderer` is a plain TypeScript class that:

1. Holds a ref to the canvas context
2. Accepts a `RenderState` snapshot on every Zustand store change
3. Uses `requestAnimationFrame` with a dirty flag to batch redraws
4. Is the only code that calls `ctx.drawXxx()`

This means **zero React re-renders happen for drawing operations**. Adding 100 shapes triggers 1 RAF callback, not 100 React reconciliation passes.

### Object Store vs Scene Store

```
objectStore  { [id: string]: Shape }    ← all objects, flat map
sceneStore   { scene: Scene }           ← which objectIds are in the current scene
```

The scene holds only IDs. This allows future multi-scene / linked-scene features without duplicating shape data.

### Future-Ready Patterns

- **Animation/Recording (f3):** Call `renderer.update(state)` at 60fps from a playback loop. React is not involved.
- **WASM Renderer:** `CanvasRenderer` is the only file that draws. Swap its internals for a WASM module; nothing else changes.
- **Layers (f1):** `Layer[]` already exists on `Scene`. `objectStore` shapes have `layerId`. Renderer filters by visible layers.
- **Annotations (f2):** Add a separate `annotationStore` keyed by shapeId. Renderer draws them in a second pass.

## Directory Map

```
client/src/
  components/
    Header/          Filename input, Save/New/Open buttons
    Toolbar/         Left-rail shape palette; drag-to-canvas + double-click
    Canvas/          <canvas> mount, mouse events, keyboard delete
    FileManager/     Modal popup: list/load/delete localStorage saves
  renderer/
    CanvasRenderer.ts  RAF loop, viewport transform, hit test, world coords
    shapes/            One draw function per shape type
  store/
    sceneStore.ts    Active scene, selected IDs, active tool
    objectStore.ts   All shape objects
    fileStore.ts     localStorage file list + modal open/close state
  types/
    shapes.ts        ShapeType union + per-shape interfaces
    scene.ts         Scene, Layer, SavedFile
  utils/
    storage.ts       localStorage read/write helpers
```

## Interaction Flows

### Placing a Shape
1. User clicks toolbar item → `sceneStore.activeTool` is set
2. User clicks canvas → `DrawingCanvas.handleMouseDown` creates a shape via `makeShape`
3. Shape added to `objectStore`, ID added to `sceneStore.scene.objectIds`
4. Zustand subscriber in `DrawingCanvas` fires `renderer.update()`
5. RAF fires, shape appears on canvas

### Drag from Toolbar
1. `DragStart` on toolbar button sets `dataTransfer` with shape type
2. `Drop` on canvas → world coords computed → `makeShape` called

### Save / Load
1. Save: serializes `scene` + referenced `objects` to JSON, writes to localStorage via `fileStore.persist`
2. Open: `FileManager` popup reads `fileStore.files`, click loads scene JSON back into stores
