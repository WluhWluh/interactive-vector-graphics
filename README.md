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

## Architecture Direction

- SVG/path assets remain the source of truth for authored graphics.
- Canvas Path2D will become the main lightweight runtime for key vector actors.
- Paper.js will be used for local vector geometry experiments and deformation.
- Three.js/WebGL will be reserved for optional background, depth, or high-volume
  simple objects such as particles or boids.
