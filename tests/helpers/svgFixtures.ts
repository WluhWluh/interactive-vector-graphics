export function createFilledFaceSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">',
    '<path fill="#ffcf4a" d="M -50 0 C -50 -33 -21 -50 0 -50 C 21 -50 50 -33 50 0 C 50 33 21 50 0 50 C -21 50 -50 33 -50 0 Z" />',
    "</svg>",
  ].join("");
}

export function createInvalidMultiPathSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="#ffcf4a" d="M 0 0 L 50 0 L 50 50 Z" />',
    '<path fill="#ffcf4a" stroke="#111827" d="M 10 10 L 20 10 L 20 20 Z" />',
    "</svg>",
  ].join("");
}

export function createTealStrokeSvg(strokeWidth = 12): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<path fill="none" stroke="#5bc4bf" stroke-width="${strokeWidth}" d="M 10 80 C 30 20 70 20 90 80" />`,
    "</svg>",
  ].join("");
}
