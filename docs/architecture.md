# Editor Architecture Notes

This document records the current engineering boundaries for the experimental
editor. It is intentionally lightweight: the source code remains the authority,
but future feature work should use these seams instead of growing `main.ts` or
`dataStore.ts` again.

## Runtime Shape

- `/index.html` is the clean Path2D stage runtime.
- `/editor.html` is the authoring surface. It owns project management, primitive
  import, Source Path Edit, Asset Assembly, prefab-local timeline editing, and
  Scene Layout.
- The visual truth for primitives is Canvas Path2D drawing. Three.js is an
  editor aid for camera math, selection proxies, transform handles, 3D source
  curve controls, and optional spatial experiments.

## Primitive Asset Pipeline

Primitive asset data is split by concern:

- `src/core/assets/primitiveAssetTypes.ts` defines the asset union.
- `primitiveSvgImport.ts` parses strict one-path SVG input.
- `primitiveAssetHydration.ts` turns API DTOs into browser assets with `Path2D`.
- `primitiveAssetCapabilities.ts` answers feature support questions by
  `assetKind`.
- `primitiveAssetSvg.ts` serializes normalized project-native SVG output.
- `structuredBezierPath*.ts` store the 2D and 3D editing source data.

The supported asset kinds are:

- `filledPath`: closed 2D fill primitives.
- `strokePath`: open 2D stroke primitives with fixed round cap/join rendering.
- `bezierCurve3d`: open 3D curve copies created from `strokePath` assets.

New asset kinds should start by adding type and capability entries, then extend
server validation, hydration, rendering, inspector rows, and tests.

## Pose Layers

Prefab editing separates three concepts:

- Base pose: the prefab node defaults saved in the prefab document.
- Evaluated pose: the active clip evaluated at the current timeline time.
- Staging pose: a browser-only editing ghost for the selected clip/node.

`src/editor/pose/prefabPose.ts` and `src/editor/timeline/stagingPose.ts` hold
the shared rules. Timeline tools should edit staging when an active clip exists
and edit base pose only when timeline editing is inactive. `Add Keyframe`
samples only the active tool's property.

## Tool Model

`src/editor/tools/toolController.ts` defines the equal-rank editor tools:

- Move -> `position`
- Rotate -> `rotation`
- Scale -> `scale`
- Path -> `path`

The Path tool is enabled only for active prefab clips and editable 2D primitive
nodes. Future animated properties, such as fill color or stroke width, should
follow this pattern: add a tool definition, define its staging value, add a
timeline property evaluator, then wire a focused inspector/control surface.

## Path Editing

There are two path-editing surfaces:

- Source Path Edit edits the project-level asset source and saves through the
  backend. For 3D curves, it shows Three.js controls for 3D anchors/handles.
- In-place timeline Path edit edits the selected prefab node's staging ghost and
  persists only when `Add Keyframe` writes a prefab `path` keyframe.

Shared 2D edit logic lives under `src/editor/tools/pathEditCore.ts` and
`pathEditCommands.ts`. 3D source-edit logic lives under
`src/editor/tools/pathEdit3dCore.ts`.

## Rendering Boundaries

- `src/editor/render/billboardRenderer.ts` draws primitive billboards.
- `billboardFrameData.ts` prepares per-frame evaluated/staging drawing data.
- `viewportProxySync.ts` keeps Three.js proxy objects aligned with editor state.
- `editorFrameRenderer.ts` coordinates vector, overlay, and Three.js rendering.

Rendering changes should prefer adding renderer inputs or caches over reaching
back into global editor state.

## Backend Persistence

`server/dataStore.ts` is a facade that composes focused stores:

- `server/stores/projectStore.ts`
- `server/stores/primitiveAssetStore.ts`
- `server/stores/prefabStore.ts`
- `server/stores/sceneStore.ts`

Routes should continue to use the facade unless a larger API refactor is
planned. Runtime data remains under `IVG_DATA_DIR` or repo-root `data/` by
default, with SQLite metadata and normalized project files stored side by side.

## Tests

- `npm run test:server` runs a server data-store smoke test through
  `tests/server-smoke.ts`, with shared assertions in `tests/helpers`.
- `npm run test:visual` runs Playwright editor and stage smoke tests.
- Test SVG fixtures belong in `tests/helpers/svgFixtures.ts`.

When adding features, prefer focused helpers and fixtures before adding another
long end-to-end path. The current large editor smoke remains useful as a broad
regression net, but new capabilities should get narrower tests where practical.
