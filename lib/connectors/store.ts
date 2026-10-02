import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Caché persistente en disco (.cache/). Sobrevive a reinicios y al recompilado de Next en dev,
 * que reinicia los módulos y vaciaba la caché en memoria.
 */
const DIR = path.resolve(process.cwd(), process.env.CACHE_DIR || ".cache");
const safe = (k: string) => k.replace(/[^\w.-]+/g, "_");

export async function readJson<T>(key: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(path.join(DIR, safe(key) + ".json"), "utf8")) as T; } catch { return null; }
}
export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const f = path.join(DIR, safe(key) + ".json"), tmp = f + "." + process.pid + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(value)); await fs.rename(tmp, f); // escritura atómica
  } catch (e) { console.warn("[store]", (e as Error).message); }
}
export const cacheDir = (sub: string) => path.join(DIR, sub);

/** Estado compartido entre recompilados (HMR) y rutas: vive en globalThis, no en el módulo. */
export function shared<T>(name: string, init: () => T): T {
  const g = globalThis as unknown as Record<string, unknown>;
  return (g[`__wm_${name}`] ??= init()) as T;
}
