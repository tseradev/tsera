export type Colorizer = (text: string) => string;

export const bold = createModifier("\x1b[1m", "\x1b[22m");
export const dim = createModifier("\x1b[2m", "\x1b[22m");
export const cyan = createModifier("\x1b[36m", "\x1b[39m");
export const green = createModifier("\x1b[32m", "\x1b[39m");
export const magenta = createModifier("\x1b[35m", "\x1b[39m");
export const red = createModifier("\x1b[31m", "\x1b[39m");
export const yellow = createModifier("\x1b[33m", "\x1b[39m");
export const blue = createModifier("\x1b[34m", "\x1b[39m");
export const gray = createModifier("\x1b[90m", "\x1b[39m");

export function createModifier(open: string, close: string): Colorizer {
  return (text: string) => (Deno.noColor ? text : `${open}${text}${close}`);
}
