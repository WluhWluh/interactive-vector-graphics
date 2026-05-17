import {
  cloneEditorV2Layout,
  createDefaultEditorV2Layout,
  parseEditorV2LayoutDocument,
  type EditorV2LayoutDocument,
} from "./layout";

const EDITOR_V2_LAYOUT_COOKIE_NAME = "ivg_editor_v2_layout";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readEditorV2CookieLayout(): EditorV2LayoutDocument {
  const rawValue = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${EDITOR_V2_LAYOUT_COOKIE_NAME}=`));

  if (!rawValue) {
    return createDefaultEditorV2Layout();
  }

  try {
    const encoded = rawValue.slice(EDITOR_V2_LAYOUT_COOKIE_NAME.length + 1);
    const parsed = JSON.parse(decodeURIComponent(encoded)) as unknown;
    return parseEditorV2LayoutDocument(parsed) ?? createDefaultEditorV2Layout();
  } catch {
    return createDefaultEditorV2Layout();
  }
}

export function writeEditorV2CookieLayout(
  layout: EditorV2LayoutDocument,
): void {
  document.cookie = [
    `${EDITOR_V2_LAYOUT_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(cloneEditorV2Layout(layout)),
    )}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
}
