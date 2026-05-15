export function toDataRelativePath(dataDir: string, path: string): string {
  return path.slice(dataDir.length + 1).replaceAll("\\", "/");
}
