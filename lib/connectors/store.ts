import { promises as fs } from "node:fs";
import path from "node:path";
import type { Store } from "@netlify/blobs";

/**
 * Caché persistente. Tres entornos:
 *  - Local (`npm run dev`):  disco, en .cache/ (como siempre).
 *  - Netlify (runtime):      Netlify Blobs, SOLO LECTURA desde la web. Disco = /tmp (efímero, para miniaturas).
 *  - Job de scraping:        Netlify Blobs con credenciales explícitas (NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN).
 */
export const SERVERLESS = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_BLOBS_CONTEXT);
const CREDS = process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN
  ? { siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN } : null;
const USE_BLOBS = SERVERLESS || !!CREDS;

const DIR = SERVERLESS ? "/tmp/wm-cache" : path.resolve(process.cwd(), process.env.CACHE_DIR || ".cache");
const safe = (k: string) => k.replace(/[^\w.-]+/g, "_");

let storeP: Promise<Store> | null = null;
const blobs = () => (storeP ??= import("@netlify/blobs").then(({ getStore }) =>
  CREDS ? getStore({ name: "watch-market", ...CREDS }) : getStore("watch-market")));

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    if (USE_BLOBS) return ((await (await blobs()).get(safe(key), { type: "json" })) as T | null) ?? null;
    return JSON.parse(await fs.readFile(path.join(DIR, safe(key) + ".json"), "utf8")) as T;
  } catch (e) {
    if (USE_BLOBS) console.warn("[store] no se pudo leer", key, (e as Error).message);
    return null;
  }
}
/** Devuelve false si no se pudo guardar (el job de scraping lo usa para fallar de forma visible). */
export async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    if (USE_BLOBS) { await (await blobs()).setJSON(safe(key), value); return true; }
    await fs.mkdir(DIR, { recursive: true });
    const f = path.join(DIR, safe(key) + ".json"), tmp = f + "." + process.pid + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(value)); await fs.rename(tmp, f); // escritura atómica
    return true;
  } catch (e) { console.warn("[store] no se pudo guardar", key, (e as Error).message); return false; }
}
export const cacheDir = (sub: string) => path.join(DIR, sub);

/** Estado compartido entre recompilados (HMR) y rutas: vive en globalThis, no en el módulo. */
export function shared<T>(name: string, init: () => T): T {
  const g = globalThis as unknown as Record<string, unknown>;
  return (g[`__wm_${name}`] ??= init()) as T;
}
