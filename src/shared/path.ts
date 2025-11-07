const OS_SEP = Deno.build.os === "windows" ? "\\" : "/";

/**
 * Replaces mixed path separators with the separator preferred by the target platform.
 */
function normalizeSeparator(path: string, sep: string): string {
  const pattern = sep === "\\" ? /[\\/]+/g : /[\/]+/g;
  return path.replace(pattern, sep);
}

/**
 * Splits a path into segments, removing duplicate separators and empty tokens.
 */
function splitSegments(path: string, sep: string): string[] {
  path = normalizeSeparator(path, sep);
  const parts = path.split(sep);
  if (parts.length === 1 && parts[0] === "") {
    return [];
  }
  return parts.filter((part) => part.length > 0);
}

/**
 * Determines whether a path is absolute for the current platform.
 */
function isAbsolute(path: string): boolean {
  if (path.length === 0) {
    return false;
  }
  if (path.startsWith("/")) {
    return true;
  }
  if (path.startsWith("\\")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Normalises path segments, removing {@code .} entries and resolving {@code ..} when possible.
 */
function normalizeSegments(segments: string[], absolute: boolean): string[] {
  const result: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (result.length > 0 && result[result.length - 1] !== "..") {
        result.pop();
        continue;
      }
      if (!absolute) {
        result.push("..");
      }
      continue;
    }
    result.push(segment);
  }
  return result;
}

/**
 * Reassembles normalised path segments into a string using the provided separator.
 */
function formatPath(segments: string[], absolute: boolean, sep: string): string {
  const joined = segments.join(sep);
  if (!absolute) {
    return joined.length === 0 ? "." : joined;
  }

  if (segments.length === 0) {
    return sep;
  }

  if (sep === "\\" && /^[A-Za-z]:$/.test(segments[0])) {
    if (segments.length === 1) {
      return `${segments[0]}${sep}`;
    }
    const rest = segments.slice(1).join(sep);
    return `${segments[0]}${sep}${rest}`;
  }

  return `${sep}${joined}`;
}

/**
 * Joins multiple path segments, resolving relative markers and absolute overrides.
 */
export function join(...segments: string[]): string {
  if (segments.length === 0) {
    return ".";
  }
  let absolute = false;
  let collected: string[] = [];

  for (const segment of segments) {
    if (segment === undefined) {
      continue;
    }
    const str = String(segment);
    if (str.length === 0) {
      continue;
    }
    if (isAbsolute(str)) {
      absolute = true;
      collected = splitSegments(str, OS_SEP);
      continue;
    }
    collected = collected.concat(splitSegments(str, OS_SEP));
  }

  const normalized = normalizeSegments(collected, absolute);
  return formatPath(normalized, absolute, OS_SEP);
}

/**
 * Returns the directory portion of a path, mimicking {@code path.dirname} semantics.
 */
export function dirname(path: string): string {
  path = normalizeSeparator(path, OS_SEP);
  if (path === OS_SEP) {
    return OS_SEP;
  }
  const segments = splitSegments(path, OS_SEP);
  if (segments.length <= 1) {
    return isAbsolute(path) ? OS_SEP : ".";
  }
  segments.pop();
  return formatPath(segments, isAbsolute(path), OS_SEP);
}

/**
 * Resolves a path against the current working directory when it is not already absolute.
 */
export function resolve(path: string): string {
  if (isAbsolute(path)) {
    return join(path);
  }
  return join(Deno.cwd(), path);
}

/** POSIX-specific join helper exposed via {@link posixPath}. */
function posixJoin(...segments: string[]): string {
  return joinWithSep("/", ...segments);
}

/** POSIX-specific dirname helper exposed via {@link posixPath}. */
function posixDirname(path: string): string {
  return dirnameWithSep("/", path);
}

/** POSIX relative path implementation. */
function posixRelative(from: string, to: string): string {
  const fromNorm = joinWithSep("/", from);
  const toNorm = joinWithSep("/", to);
  const fromSegs = splitSegments(fromNorm, "/");
  const toSegs = splitSegments(toNorm, "/");

  while (fromSegs.length > 0 && toSegs.length > 0 && fromSegs[0] === toSegs[0]) {
    fromSegs.shift();
    toSegs.shift();
  }

  const upwards = new Array(fromSegs.length).fill("..");
  return [...upwards, ...toSegs].join("/") || ".";
}

/** Generalised join that accepts an explicit separator. */
function joinWithSep(sep: string, ...segments: string[]): string {
  let absolute = false;
  let collected: string[] = [];
  for (const segment of segments) {
    const str = String(segment);
    if (str.length === 0) {
      continue;
    }
    if (str.startsWith(sep)) {
      absolute = true;
      collected = splitSegments(str, sep);
      continue;
    }
    collected = collected.concat(splitSegments(str, sep));
  }
  const normalized = normalizeSegments(collected, absolute);
  return formatPath(normalized, absolute, sep);
}

/** Generalised dirname that accepts an explicit separator. */
function dirnameWithSep(sep: string, path: string): string {
  path = normalizeSeparator(path, sep);
  if (path === sep) {
    return sep;
  }
  const segments = splitSegments(path, sep);
  if (segments.length <= 1) {
    return path.startsWith(sep) ? sep : ".";
  }
  segments.pop();
  return formatPath(segments, path.startsWith(sep), sep);
}

/**
 * POSIX-flavoured path helpers mirroring Node's {@code path.posix}.
 *
 * Provides path manipulation functions that always use forward slashes,
 * regardless of the operating system.
 */
export const posixPath = {
  /** Joins path segments using forward slashes. */
  join: posixJoin,
  /** Returns the directory portion of a path using forward slashes. */
  dirname: posixDirname,
  /** Computes the relative path between two paths using forward slashes. */
  relative: posixRelative,
};
