// Module-resolution hook for scripts/verify-auth.mjs. It lets the REAL lib/ and
// app/actions.js modules run under plain Node by swapping the few framework imports
// for tiny stand-ins (scripts/stubs/*.mjs) and by resolving the "@/" alias.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stub = (name) => pathToFileURL(path.join(root, "scripts", "stubs", name)).href;

const STUBS = {
  "server-only": stub("empty.mjs"),
  "next/headers": stub("next-headers.mjs"),
  "next/navigation": stub("next-navigation.mjs"),
  react: stub("react.mjs"),
};

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  if (specifier.startsWith("@/")) {
    let file = path.join(root, specifier.slice(2));
    if (!path.extname(file) && existsSync(file + ".js")) file += ".js";
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
