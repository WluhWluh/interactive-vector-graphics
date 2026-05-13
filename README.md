# Interactive Vector Graphics

An SVG-first playground for interactive vector graphics experiments inspired by
clean science-explainer motion graphics.

The current milestone is still deliberately compact: a Vite + TypeScript
frontend, a Fastify API server, SQLite-backed project metadata, and uploaded SVG
primitive files stored in a Git-ignored runtime data directory.

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
- `/editor.html` is the early editor shell with project/asset management, SVG
  import, project-level prefab assembly, scene layout, a camera/transform
  experiment viewport, and Inspector.

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
Uploaded SVG source files are stored under
`data/projects/<project-id>/primitives/`. Prefab documents live under
`data/projects/<project-id>/prefabs/`, and scene documents live under
`data/projects/<project-id>/scenes/` as JSON files. Project assets, prefabs,
scenes, and future animation data are intentionally separate from source code.
Only code, fixtures, and built-in demos should enter Git.

For local development, run both servers:

```sh
npm run dev:all
```

Then open:

- `http://127.0.0.1:5173/editor.html` for the editor.
- `http://127.0.0.1:5173/index.html` for the clean display stage.

## Architecture Direction

- SVG/path assets remain the source of truth for authored graphics.
- Canvas Path2D will become the main lightweight runtime for key vector actors.
- Paper.js will be used for local vector geometry experiments and deformation.
- Three.js/WebGL will be reserved for optional background, depth, or high-volume
  simple objects such as particles or boids.
- In the editor, Three.js also provides camera math, grid/axes helpers,
  selection proxies, OrbitControls, and TransformControls. SVG primitives still
  render through Canvas Path2D so this does not change the visual runtime target.
- `/editor.html` has two early authoring modes. `Asset Assembly` builds
  project-level prefabs from primitive SVG parts and optional transform groups.
  `Scene Layout` places prefab reference instances in the spatial scene.
- Scene documents store prefab instance references instead of unpacking prefab
  contents. This keeps reusable character/prop assemblies editable at the
  project level.
- The editor can save and load the current camera and scene nodes as scene
  document v2. Animation data is reserved as `{ fps: 24, activeClipId: null,
  clips: [] }` until the timeline exists.

## Primitive SVG Assets

The first import pipeline is deliberately strict. Each primitive SVG should be a
single solid-color closed path exported from Illustrator:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">
  <path fill="#ffcf4a" d="M ... Z" />
</svg>
```

Allowed:

- One `<path>` with `d`, `fill`, and optional `fill-rule`.
- One wrapper `<g>` only when it has no `transform`, `class`, or `style`.
- `fill` and `fill-rule` may also come from the path `style` attribute.

Rejected:

- Multiple paths, open paths, strokes, transforms, class-based styles, opacity,
  gradients, filters, masks, clips, text, images, symbols, and basic shape
  elements such as rect/circle/polygon.

Built-in primitive assets are listed in `public/assets/primitive-assets.json`.
The runtime loads that manifest, imports each SVG, and registers it in memory.
