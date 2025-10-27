const OS_SEP = Deno.build.os === "windows" ? "\\" : "/";

function normalizeSeparator(path: string, sep: string): string {
  const pattern = sep === "\\" ? /[\\/]+/g : /[\/]+/g;
  return path.replace(pattern, sep);
}

function splitSegments(path: string, sep: string): string[] {
  path = normalizeSeparator(path, sep);
  const parts = path.split(sep);
  if (parts.length === 1 && parts[0] === "") {
    return [];
  }
  return parts.filter((part) => part.length > 0);
}

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

function formatPath(segments: string[], absolute: boolean, sep: string): string {
  const joined = segments.join(sep);
  if (absolute) {
    return `${sep}${joined}`;
  }
  return joined.length === 0 ? "." : joined;
}

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

export function resolve(path: string): string {
  if (isAbsolute(path)) {
    return join(path);
  }
  return join(Deno.cwd(), path);
}

function posixJoin(...segments: string[]): string {
  return joinWithSep("/", ...segments);
}

function posixDirname(path: string): string {
  return dirnameWithSep("/", path);
}

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

export const posixPath = {
  join: posixJoin,
  dirname: posixDirname,
  relative: posixRelative,
};
