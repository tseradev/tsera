/**
 * Converts a file:// URL to a platform-specific file path.
 * Handles Windows and Unix path separators correctly.
 *
 * @throws {TypeError} If the URL protocol is not "file:"
 */
export function fromFileUrl(url: URL): string {
  if (url.protocol !== "file:") {
    throw new TypeError(`Expected a file URL, received ${url.protocol}`);
  }

  let path = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows") {
    if (path.startsWith("/")) {
      path = path.slice(1);
    }
    return path.replaceAll("/", "\\");
  }
  return path;
}
