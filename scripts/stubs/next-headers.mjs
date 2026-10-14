// A cookie jar the test controls. Mirrors the parts of cookies() the app uses.
export const jar = (globalThis.__testJar ??= { values: new Map(), writes: [] });

export function cookies() {
  return {
    get(name) {
      return jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined;
    },
    set(name, value, options = {}) {
      jar.writes.push({ name, value, options });
      if (options.maxAge === 0 || value === "") jar.values.delete(name);
      else jar.values.set(name, value);
    },
  };
}
