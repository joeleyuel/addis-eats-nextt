// Day 48 pre-flight, the parts that need no install and no network:
//   1. every relative and "@/" import resolves to a file whose NAME MATCHES EXACTLY —
//      macOS forgives ./dishCard for ./DishCard, the Linux machine that builds it does not
//      (this check reads the real directory listing, so it is case-sensitive everywhere)
//   2. nothing named like a secret is NEXT_PUBLIC_
//   3. every remote image host used by the menu data is allowed in next.config.mjs
//   npm run check:imports
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "public"]);
const problems = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Does `target` exist with exactly this capitalisation, every segment of the way?
function existsExactly(target) {
  const rel = path.relative(root, target).split(path.sep);
  let current = root;
  for (const part of rel) {
    if (!readdirSync(current).includes(part)) return false;
    current = path.join(current, part);
  }
  return true;
}

function resolveImport(fromFile, spec) {
  const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...[".js", ".jsx", ".mjs", ".css", ".json"].map((e) => base + e), ...["index.js", "index.jsx"].map((i) => path.join(base, i))];
  const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile());
  if (!hit) return { missing: true };
  return { file: hit, exact: existsExactly(hit) };
}

const files = walk(root).filter((f) => /\.(js|jsx|mjs)$/.test(f));
const importRe = /(?:import\s+(?:[^'"]*?\sfrom\s+)?|import\(\s*|require\(\s*)["']([^"']+)["']/g;
let checked = 0;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importRe)) {
    const spec = match[1];
    if (!(spec.startsWith(".") || spec.startsWith("@/"))) continue;
    checked += 1;
    const result = resolveImport(file, spec);
    const where = `${path.relative(root, file)}: "${spec}"`;
    if (result.missing) problems.push(`${where} does not resolve to a file`);
    else if (!result.exact) problems.push(`${where} resolves only because this file system ignores case`);
  }
}

// 2. NEXT_PUBLIC_ on a secret-looking name, anywhere in source or env files
for (const file of [...files, ...[".env.example", ".env.local"].map((f) => path.join(root, f)).filter(existsSync)]) {
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE|KEY)[A-Z0-9_]*/g)) {
    problems.push(`${path.relative(root, file)}: ${m[0]} would be published in the browser bundle`);
  }
}

// 3. remote image hosts vs next.config.mjs
const config = readFileSync(path.join(root, "next.config.mjs"), "utf8");
const allowed = new Set([...config.matchAll(/"([a-z0-9.-]+\.[a-z]{2,})"/gi)].map((m) => m[1]));
const menu = JSON.parse(readFileSync(path.join(root, "data", "menu-data.json"), "utf8"));
const hosts = new Set();
(function collect(value) {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    try {
      hosts.add(new URL(value).hostname);
    } catch {
      /* not a URL */
    }
  } else if (value && typeof value === "object") Object.values(value).forEach(collect);
})(menu);
for (const host of hosts) if (!allowed.has(host)) problems.push(`menu data uses image host ${host}, which next.config.mjs does not allow`);

if (problems.length) {
  console.error("Pre-flight problems:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log(`Imports OK: ${checked} relative/@ imports in ${files.length} files resolve with exact case; no secret is NEXT_PUBLIC_; ${hosts.size} remote image host(s), all allowed.`);
