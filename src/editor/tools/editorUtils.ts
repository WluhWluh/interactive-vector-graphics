export function chooseStableSelection(
  currentId: string | null,
  availableIds: string[],
): string | null {
  if (currentId && availableIds.includes(currentId)) {
    return currentId;
  }

  return availableIds[0] ?? null;
}

export function getNextNodeNumber(ids: string[], prefix: string): number {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const largestExistingNumber = ids.reduce((largest, id) => {
    const match = pattern.exec(id);
    const value = match ? Number(match[1]) : 0;

    return Number.isFinite(value) ? Math.max(largest, value) : largest;
  }, 0);

  return largestExistingNumber + 1;
}

export function createUniqueId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function slugifyTimelineName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "clip";
}

export function formatTransformValue(value: number): string {
  return String(roundTransformValue(value));
}

export function roundTransformValue(value: number): number {
  return Number(value.toFixed(4));
}

export function formatTimelineNumber(value: number): string {
  return String(roundTimelineNumber(value));
}

export function roundTimelineNumber(value: number): number {
  return Number(value.toFixed(3));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
