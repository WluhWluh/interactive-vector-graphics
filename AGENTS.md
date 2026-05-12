# AGENTS.md

## Project Intent

This project explores SVG-first interactive vector graphics for the web. The
visual target is closer to Kurzgesagt-style science-explainer motion graphics
than to the heavier 3D/game look of Star Birds.

## Collaboration Preferences

- Keep true SVG/path assets as the authored source of truth whenever possible.
- Prefer a Canvas Path2D runtime for the main interactive vector layer.
- Use Paper.js for vector geometry experiments, local deformation, path sampling,
  and authoring-time ideas that may later be baked into runtime data.
- Use Three.js/WebGL only as an optional layer for spatial backgrounds, depth
  accents, or high-volume simple objects such as particles and boids.
- Keep hero characters and key interactive objects precise and hand-authored.
- Cache, simplify, or downgrade distant crowds, background details, and repeated
  objects when performance pressure appears.
- Avoid drifting into a low-poly 3D game style unless the user explicitly asks
  for that experiment.
- The user primarily owns art direction, Illustrator/SVG drawing, and manually
  refined key poses or animation timing.
- Codex primarily owns the engineering foundation, runtime architecture, tooling,
  geometry utilities, performance instrumentation, and implementation details.

## Code Style

- Write comments in English for authored code.
- Prefer detailed comments at architectural boundaries and sparse comments for
  obvious implementation details.
- Keep early milestones small and verifiable instead of rushing into complex
  demos.
- Preserve a clear separation between the vector runtime layer, the Paper.js
  experiment layer, and the optional Three.js/WebGL layer.

## Primitive SVG Import Rules

- First-stage SVG assets are strict primitives: one file, one solid-color closed
  `<path>`, no stroke.
- A single wrapper `<g>` is allowed only when it has no transform, class, or
  style.
- `fill` and `fill-rule` may be read from attributes or from the path `style`
  attribute.
- Reject complex SVG features instead of trying to clean them automatically:
  multiple paths, transforms, gradients, filters, masks, clips, text, images,
  symbols, class styles, opacity, and basic shape elements.
- Compose birds, characters, props, and animated forms later in the editor from
  multiple primitive assets rather than exporting grouped character SVGs.

## Entrypoint Rules

- Keep `/index.html` as the clean runtime stage without editor UI.
- Use `/editor.html` for authoring UI experiments such as asset import, selection,
  preview, and future scene editing.
- Shared rendering and asset code belongs under `src/core`; entrypoint-specific
  behavior belongs under `src/stage` or `src/editor`.
- Editor-only Three.js helpers may live under `src/editor`; keep them separate
  from the clean Path2D stage runtime.
- The camera/transform experiment scene can now be saved as a backend scene
  document. Keep `/editor.html` as the only authoring surface for this until a
  clean runtime scene loader is explicitly planned.
- Canvas billboard rendering should remain the source of visual truth for SVG
  primitives; Three.js proxies are for editing, picking, and transform handles.

## Runtime Data Rules

- Source code, built-in fixtures, and documentation are tracked in Git.
- User-created project data, imported assets, scenes, and animation outputs live
  under the runtime data directory and must not enter Git.
- The default local data directory is repo-root `data/`, which is ignored.
- `IVG_DATA_DIR` may point the backend at another data directory when switching
  machines, deployments, or long-running experiments.
- Keep backend persistence APIs under `server/`; do not make frontend code write
  directly into repository files.
- Project metadata currently lives in SQLite at `data/ivg.sqlite`; uploaded SVG
  sources live beside their project under `data/projects/<project-id>/`.
- Scene metadata lives in the same SQLite database; scene documents are JSON
  files under `data/projects/<project-id>/scenes/`.
- Scene document v2 stores camera, nodes, and animation clips/tracks/keyframes.
  The editor currently writes an empty animation placeholder and does not play or
  edit keyframes yet. Save and load whole documents; do not add partial patch
  persistence yet.
- Loading scenes must tolerate missing asset references so deleting an asset does
  not make old scene documents unreadable.
- Validate primitive SVG imports on the server before saving them. Browser-side
  preview logic may help UX, but it must not be the persistence authority.
- Treat runtime data as disposable experiment data until explicit export/import
  tooling exists.
