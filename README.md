# Interactive Vector Graphics

An SVG-first playground for interactive vector graphics experiments inspired by
clean science-explainer motion graphics.

The current milestone is still deliberately compact, but it now includes a
usable authoring loop: a Vite + TypeScript frontend, a Fastify API server,
SQLite-backed project metadata, normalized primitive SVG files, prefab-local
timeline animation, source path editing, and scene layout data stored in a
Git-ignored runtime data directory.

## Scripts

- `npm run dev` starts the local development server.
- `npm run server:dev` starts the local API server.
- `npm run dev:all` starts both the API server and Vite.
- `npm run check` runs TypeScript without emitting files.
- `npm run build` type-checks and builds the project.
- `npm run test:server` runs the backend data-store smoke test.
- `npm run test:visual` runs the Playwright visual smoke test in headless Edge.
- `npm run preview` serves the production build locally.

## Entrypoints

- `/index.html` is the clean stage runtime for embedding or presentation.
- `/editor.html` is the editor shell with project/asset management, SVG import,
  source path editing, project-level prefab assembly, prefab-local timeline
  editing, scene layout, a camera/transform viewport, and Inspector.

The editor now works against the backend API. Projects and imported primitive
assets persist in the runtime data directory until you delete them from the UI or
remove that directory yourself.

## Local Data Server

The backend provides a small Fastify API for project, primitive asset, prefab,
and scene document data:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects` with `{ "name": "My Test Project" }`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/assets`
- `POST /api/projects/:projectId/assets` as `multipart/form-data`
- `POST /api/projects/:projectId/assets/view-morph-profile`
- `PUT /api/projects/:projectId/assets/:assetId/path`
- `PUT /api/projects/:projectId/assets/:assetId/view-morph-profile`
- `POST /api/projects/:projectId/assets/:assetId/convert-to-3d-curve`
- `PUT /api/projects/:projectId/assets/:assetId/curve3d`
- `DELETE /api/projects/:projectId/assets/:assetId`
- `GET /api/projects/:projectId/prefabs`
- `POST /api/projects/:projectId/prefabs`
- `GET /api/projects/:projectId/prefabs/:prefabId`
- `PUT /api/projects/:projectId/prefabs/:prefabId`
- `DELETE /api/projects/:projectId/prefabs/:prefabId`
- `GET /api/projects/:projectId/scenes`
- `POST /api/projects/:projectId/scenes`
- `GET /api/projects/:projectId/scenes/:sceneId`
- `PUT /api/projects/:projectId/scenes/:sceneId`
- `DELETE /api/projects/:projectId/scenes/:sceneId`

By default, runtime data is stored in `data/` at the repository root. That folder
is ignored by Git. Set `IVG_DATA_DIR` to use another folder, and
`IVG_SERVER_PORT` to override the default API port `4317`. Vite's local `/api`
proxy reads the same port value.

Project, primitive, prefab, and scene metadata is stored in `data/ivg.sqlite`.
Imported primitive SVGs are validated and rewritten as normalized project-native
SVG files under `data/projects/<project-id>/primitives/`. Prefab documents live under
`data/projects/<project-id>/prefabs/`, and scene documents live under
`data/projects/<project-id>/scenes/` as JSON files. Project assets, prefabs,
scenes, and animation data are intentionally separate from source code.
Only code, fixtures, and built-in demos should enter Git.
Each primitive asset stores normalized structured Bezier path data in SQLite
beside `pathD`, and editor-created assets such as `viewMorphProfile` also keep
their source JSON in the same project database. Source Path Edit can update the
asset source and regenerate the derived preview values. Prefab path keyframes
store structured Bezier snapshots and render through temporary `Path2D`
previews during timeline playback.

For local development, run both servers:

```sh
npm run dev:all
```

Then open:

- `http://127.0.0.1:5173/editor.html` for the editor.
- `http://127.0.0.1:5173/index.html` for the clean display stage.

## Architecture Direction

See [docs/architecture.md](docs/architecture.md) for the current engineering
boundaries between asset data, pose layers, tools, rendering, backend stores,
and tests.

- SVG/path assets remain the source of truth for authored graphics.
- Canvas Path2D is the main lightweight runtime for key vector actors in the
  stage and editor preview layers.
- Paper.js is used at authoring/import boundaries for SVG path parsing and
  structured Bezier data preparation.
- Three.js/WebGL is reserved for optional background, depth, editor camera math,
  selection proxies, transform handles, and 3D curve source editing.
- In the editor, Three.js also provides camera math, grid/axes helpers,
  selection proxies, OrbitControls, and TransformControls. SVG primitives still
  render through Canvas Path2D so this does not change the visual runtime target.
- `/editor.html` has three authoring modes. `Asset Assembly` builds
  project-level prefabs from primitive SVG parts and optional transform groups,
  and includes a prefab-local timeline. `Source Path Edit` edits primitive asset
  source curves, including 3D curve source control points. `Scene Layout` places
  prefab reference instances in the spatial scene.
- Scene documents store prefab instance references instead of unpacking prefab
  contents. This keeps reusable character/prop assemblies editable at the
  project level.
- Prefab documents use v4 and store local animation clips/tracks/keyframes for
  `position`, `rotation`, `scale`, and 2D structured `path` deformation.
  Prefab keyframe times are saved as integer milliseconds, and each prefab
  stores its own `snapFps` editing helper. The timeline also has a `Base Pose`
  editing state for prefab defaults outside animation. Scene document v2 still
  stores its animation structure but does not yet expose a scene-level timeline
  UI.

## Primitive Assets

The SVG import pipeline is deliberately strict. Directly imported SVG files
should be either a single solid-color closed filled path or a single open stroke
path exported from Illustrator:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
  <path fill="#ffcf4a" d="M ... Z" />
</svg>
```

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path fill="none" stroke="#5bc4bf" stroke-width="6" d="M 10 80 C 30 20 70 20 90 80" />
</svg>
```

Allowed:

- One filled `<path>` with `d`, `fill`, and optional `fill-rule`.
- Or one open stroked `<path>` with `fill="none"`, solid `stroke`, and positive
  `stroke-width`.
- One wrapper `<g>` only when it has no `transform`, `class`, or `style`.
- Supported style values may also come from the path `style` attribute.
- Stroked paths always render as solid round-cap, round-join lines in the editor.

Rejected:

- Multiple paths, filled open paths, closed stroked paths, mixed solid fill and
  stroke, stroke dashes, transforms, class-based styles, opacity, gradients,
  filters, masks, clips, text, images, symbols, and basic shape elements such as
  rect/circle/polygon.

Built-in primitive assets are listed in `public/assets/primitive-assets.json`.
The runtime loads that manifest, imports each SVG, and registers it in memory.
During import, the path `d` is parsed into stable Bezier segments with anchors
and relative handles. Filled primitives must produce a closed structured path
with at least three segments; stroked primitives must produce an open structured
path with at least two segments.

Primitive assets currently support four asset kinds:

- `filledPath`: closed filled 2D paths.
- `strokePath`: open 2D strokes with fixed solid round cap/join rendering.
- `bezierCurve3d`: an open 3D Bezier curve copy created from an existing
  `strokePath`. It keeps real 3D anchors and handles, preserves stroke color and
  width, and projects to Canvas as a 2D stroke for preview and scene/prefab
  rendering. It cannot be imported directly and does not yet participate in path
  deformation keyframes.
- `viewMorphProfile`: an editor-created filled profile asset built from a
  built-in template rather than SVG import. It renders through a dedicated
  billboard evaluator and does not participate in prefab path keyframes.

`Source Path Edit` edits the project-level asset source and saves it back through
the API. In `Asset Assembly`, the timeline `Path` tool edits a temporary staging
ghost for the selected 2D primitive node; clicking `Add Keyframe` is the save
path for that deformation into the active prefab clip. `viewMorphProfile` is
edited in `Source Path Edit` and does not use in-place timeline path staging.
The source asset itself is not changed by in-place timeline path edits.
