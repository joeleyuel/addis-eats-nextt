// Boot-time environment check (no dependencies). Run: npm run check:env
// Loads .env* files in Next's order is NOT replicated; it checks process.env plus
// .env.local if present, which is what a developer sets. Exit 1 on problems.
import { readFileSync, existsSync } from "node:fs";

function load(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
load(".env.local");

const problems = [];
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 16) problems.push("SESSION_SECRET is missing or shorter than 16 characters (copy .env.example to .env.local).");
if (secret === "replace-me-with-a-long-random-string") problems.push("SESSION_SECRET is still the example value.");
for (const name of Object.keys(process.env)) {
  if (/^NEXT_PUBLIC_.*(SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE)/i.test(name)) {
    problems.push(`${name} looks like a secret but is NEXT_PUBLIC_, so it would be published in the browser bundle.`);
  }
}

if (problems.length) {
  console.error("Environment problems:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("Environment OK.");
