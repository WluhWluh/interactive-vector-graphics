export type CollapsibleModuleId =
  | "projects"
  | "primitive-assets"
  | "prefabs"
  | "prefab-contents"
  | "source-path-assets"
  | "scene-documents"
  | "scene-contents";

export const COLLAPSIBLE_MODULE_IDS: CollapsibleModuleId[] = [
  "projects",
  "primitive-assets",
  "prefabs",
  "prefab-contents",
  "source-path-assets",
  "scene-documents",
  "scene-contents",
];

const COLLAPSED_MODULE_COOKIE_NAME = "ivg_editor_collapsed_modules";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const EXPANDED_ARROW = "▴";
const COLLAPSED_ARROW = "▾";

export function renderCollapsibleModules(
  collapsedModuleIds: Set<CollapsibleModuleId>,
): void {
  for (const moduleId of COLLAPSIBLE_MODULE_IDS) {
    const moduleElement = getCollapsibleModule(moduleId);
    const body = getCollapsibleModuleBody(moduleElement, moduleId);
    const button = getModuleCollapseButton(moduleId);
    const collapsed = collapsedModuleIds.has(moduleId);

    moduleElement.dataset.collapsed = String(collapsed);
    body.hidden = collapsed;
    button.textContent = collapsed ? COLLAPSED_ARROW : EXPANDED_ARROW;
    button.setAttribute("aria-expanded", String(!collapsed));
  }
}

export function readCollapsedModuleCookie(): Set<CollapsibleModuleId> {
  const rawValue = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COLLAPSED_MODULE_COOKIE_NAME}=`))
    ?.slice(COLLAPSED_MODULE_COOKIE_NAME.length + 1);

  if (!rawValue) {
    return new Set();
  }

  const allowedIds = new Set(COLLAPSIBLE_MODULE_IDS);
  const decodedValue = decodeURIComponent(rawValue);
  const moduleIds = decodedValue
    .split(",")
    .filter((value): value is CollapsibleModuleId =>
      allowedIds.has(value as CollapsibleModuleId),
    );

  return new Set(moduleIds);
}

export function writeCollapsedModuleCookie(
  collapsedModuleIds: Set<CollapsibleModuleId>,
): void {
  const value = encodeURIComponent(
    COLLAPSIBLE_MODULE_IDS.filter((moduleId) =>
      collapsedModuleIds.has(moduleId),
    ).join(","),
  );

  document.cookie = [
    `${COLLAPSED_MODULE_COOKIE_NAME}=${value}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
}

function getCollapsibleModule(moduleId: CollapsibleModuleId): HTMLElement {
  const element = document.querySelector(
    `[data-collapsible-module="${moduleId}"]`,
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected collapsible module "${moduleId}" to exist.`);
  }

  return element;
}

function getCollapsibleModuleBody(
  moduleElement: HTMLElement,
  moduleId: CollapsibleModuleId,
): HTMLElement {
  const body = moduleElement.querySelector(".collapsible-module-body");

  if (!(body instanceof HTMLElement)) {
    throw new Error(`Expected collapsible body for module "${moduleId}".`);
  }

  return body;
}

export function getModuleCollapseButton(moduleId: CollapsibleModuleId): HTMLButtonElement {
  const button = document.querySelector(
    `[data-module-collapse-button="${moduleId}"]`,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected collapse button for module "${moduleId}".`);
  }

  return button;
}
