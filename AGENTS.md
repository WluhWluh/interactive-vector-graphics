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
