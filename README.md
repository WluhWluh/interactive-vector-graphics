# Interactive Vector Graphics

An SVG-first playground for interactive vector graphics experiments inspired by
clean science-explainer motion graphics.

The first milestone is intentionally small: a Vite + TypeScript base with three
stacked canvas layers ready for future Canvas Path2D, Paper.js, and Three.js
experiments.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks and builds the project.
- `npm run test:visual` runs the Playwright visual smoke test in headless Edge.
- `npm run preview` serves the production build locally.

## Entrypoints

- `/index.html` is the clean stage runtime for embedding or presentation.
- `/editor.html` is the early editor shell with an asset list, SVG import button,
  live preview, and read-only Inspector.

The editor stores imported SVG primitives only in memory for now. Refreshing the
page clears uploaded assets.

## Architecture Direction

- SVG/path assets remain the source of truth for authored graphics.
- Canvas Path2D will become the main lightweight runtime for key vector actors.
- Paper.js will be used for local vector geometry experiments and deformation.
- Three.js/WebGL will be reserved for optional background, depth, or high-volume
  simple objects such as particles or boids.

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
