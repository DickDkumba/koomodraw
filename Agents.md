# kooMoDraw — Agent Log

## 2026-05-14 — Initial Client Build

**Agent:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Session:** Phase 1 client scaffolding

### Decisions Made
- Stack: React 19 + TypeScript, Vite, Zustand 5, HTML5 Canvas 2D
- Aesthetic: Clean / precise (not sketch-style)
- Toolbar: Left rail
- Namespace: `kooMoDraw` (camelCase, single word for imports)

### What Was Built
- Full Vite + React + TS project scaffolded in `client/`
- Type system: `types/shapes.ts` (ShapeType union, 8 shape interfaces), `types/scene.ts` (Scene, Layer, SavedFile)
- Zustand stores: `objectStore`, `sceneStore`, `fileStore`
- `CanvasRenderer` — pure TS class, owns RAF loop, viewport transform, hit testing, world-coord conversion
- Shape draw functions: line, arrow, rectangle, circle, diamond, text, database, cylinder
- `Toolbar` component — left rail, drag-to-canvas, double-click-to-place, keyboard shortcut hints
- `Header` component — editable filename input (upper left), Save / New / Open buttons
- `DrawingCanvas` component — canvas mount, mouse select/drag, keyboard delete
- `FileManager` modal — lists localStorage saves, load / delete per file
- `App.tsx` wired together
- `docs/client-architecture.md` — architecture reference

### Architecture Notes
React shell + Canvas renderer are deliberately separate. The canvas renderer never goes through React reconciliation — this is the foundation for phase 2 animation/recording.

### Known Gaps (Phase 2 +)
- f1: Layers (structure ready, not surfaced in UI)
- f2: Per-object annotations
- f3: Recording / JSON-driven animation playback
- f4: WASM renderer swap-in
- f5: Multi-scene / linked scenes
- Line/arrow drawing not yet drag-to-draw (click places default size; resize handles TBD)
- No zoom/pan controls yet (viewport state exists in sceneStore)
