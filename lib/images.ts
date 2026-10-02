import { promises as fs } from "node:fs";
import dns from "node:dns/promises";
import net from "node:net";
import crypto from "node:crypto";
import path from "node:path";
import { UA, allowed } from "./connectors/http";
import { cacheDir, shared } from "./connectors/store";
import { isKnownImage } from "./connectors/registry";

/**
 * Proxy de miniaturas: baja cada foto UNA vez, la reduce a WebP y la guarda en .cache/img.
 * Las fotos originales de foros pesan varios MB; el grid no puede cargarlas enteras.
 * Seguridad: solo URLs que ya están en los anuncios (no es un proxy abierto) y nunca hosts internos (SSRF).
 */
const MAX_BYTES = 25 * 1024 * 1024, PER_HOST = 4;
const inflight = shared("imgInflight", () => new Map<string, Promise<Buffer | null>>());
const active = shared("imgActive", () => new Map<string, { n: number; q: (() => void)[] }>());

const privateIp = (ip: string) =>
  net.isIPv4(ip) ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip)
  : /^(::1?$|f[cd]|fe[89ab]|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.))/i.test(ip);
async function publicHost(host: string) {
  if (net.isIP(host)) return !privateIp(host);
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  try { const a = await dns.lookup(host, { all: true }); return a.length > 0 && a.every((x) => !privateIp(x.address)); } catch { return false; }
}
async function slot<T>(host: string, job: () => Promise<T>): Promise<T> {
  const s = active.get(host) ?? { n: 0, q: [] }; active.set(host, s);
  if (s.n >= PER_HOST) await new Promise<void>((r) => s.q.push(r));
  s.n++;
  try { return await job(); } finally { s.n--; s.q.shift()?.(); }
}

async function download(src: string): Promise<Buffer | null> {
  let url = new URL(src);
  for (let hop = 0; hop < 4; hop++) {                     // redirecciones a mano: se revalida cada salto
    if (!/^https?:$/.test(url.protocol) || !(await publicHost(url.hostname)) || !(await allowed(url))) return null;
    const r = await slot(url.host, () => fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(20000) }));
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = new URL(r.headers.get("location")!, url); continue; }
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    if (+(r.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= MAX_BYTES ? buf : null;
  }
  return null;
}

/** Devuelve WebP redimensionado, o null para que el llamador redirija a la foto original. */
export async function thumbnail(src: string, w: number): Promise<Buffer | null> {
  if (!(await isKnownImage(src))) return null;
  const file = path.join(cacheDir("img"), `${crypto.createHash("sha1").update(src).digest("hex")}-${w}.webp`);
  try { return await fs.readFile(file); } catch { /* no está en disco */ }
  const key = `${src}|${w}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      try {
        const raw = await download(src); if (!raw) return null;
        const sharp = (await import("sharp")).default;
        const out = await sharp(raw, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, out);
        return out;
      } catch (e) { console.warn("[img]", src, (e as Error).message); return null; }
      finally { inflight.delete(key); }
    })();
    inflight.set(key, p);
  }
  return p;
}
