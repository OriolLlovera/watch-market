import { promises as fs } from "node:fs";
import path from "node:path";
import type { Store } from "@netlify/blobs";

/**
 * Caché persistente. Tres entornos:
 *  - Local (`npm run dev`):  disco, en .cache/ (como siempre).
 *  - Netlify (runtime):      Netlify Blobs, SOLO LECTURA desde la web. Disco = /tmp (efímero, para miniaturas).
 *  - Job de scraping:        Netlify Blobs con credenciales explícitas (NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN).
 */
// En Netlify solo llegan al runtime las variables definidas en su interfaz y unas pocas de sistema, así que se miran varias.
// Si aun así no se detectara, define WM_SERVERLESS=1 en Netlify (Site configuration > Environment variables, scope Functions).
export const SERVERLESS = !!(process.env.WM_SERVERLESS === "1" || process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT
  || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV);
// .trim(): un secret pegado con salto de línea o espacios al final daría un 401 difícil de ver.
const SITE_ID = process.env.NETLIFY_SITE_ID?.trim(), TOKEN = process.env.NETLIFY_AUTH_TOKEN?.trim();
const CREDS = SITE_ID && TOKEN ? { siteID: SITE_ID, token: TOKEN } : null;
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

/** Diagnóstico para /api/status (solo booleanos: nunca expone valores de variables). */
export const storageInfo = () => ({
  mode: USE_BLOBS ? "blobs" : "disk", serverless: SERVERLESS, credentialsSet: !!CREDS,
  credentials: { NETLIFY_SITE_ID: !!SITE_ID, NETLIFY_AUTH_TOKEN: !!TOKEN },
  env: { NETLIFY: !!process.env.NETLIFY, NETLIFY_BLOBS_CONTEXT: !!process.env.NETLIFY_BLOBS_CONTEXT, AWS_LAMBDA_FUNCTION_NAME: !!process.env.AWS_LAMBDA_FUNCTION_NAME, LAMBDA_TASK_ROOT: !!process.env.LAMBDA_TASK_ROOT, WM_SERVERLESS: !!process.env.WM_SERVERLESS },
});
export async function probe(key: string): Promise<{ found: boolean; error?: string }> {
  try {
    if (USE_BLOBS) return { found: (await (await blobs()).get(safe(key), { type: "json" })) != null };
    await fs.access(path.join(DIR, safe(key) + ".json")); return { found: true };
  } catch (e) { return { found: false, error: (e as Error).message.slice(0, 200) }; }
}
