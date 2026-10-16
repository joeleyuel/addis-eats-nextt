// revalidatePath() only matters inside Next; here it just records what was asked.
export const revalidated = (globalThis.__testRevalidated ??= []);
export function revalidatePath(path, type) {
  revalidated.push([path, type]);
}
