import { thumbnail } from "@/lib/images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La foto depende SOLO de ?u= (y el ancho de ?w=). El CDN de Netlify, por defecto, ignora la query string al construir
// la clave de caché de respuestas dinámicas: sin esto, la primera foto cacheada se serviría para TODAS las URLs.
const VARY = { "netlify-vary": "query=u|w" };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, src = q.get("u") ?? "";
  const w = Math.min(1600, Math.max(80, parseInt(q.get("w") ?? "640", 10) || 640));
  const buf = await thumbnail(src, w);
  if (buf) return new Response(new Uint8Array(buf), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", ...VARY } });
  // No se pudo (robots, sharp ausente, error): la foto original, solo si es de un anuncio nuestro. Sin caché: puede ser un fallo pasajero.
  const { isKnownImage } = await import("@/lib/connectors/registry");
  return (await isKnownImage(src))
    ? new Response(null, { status: 302, headers: { location: src, "cache-control": "no-store", ...VARY } })
    : new Response("no", { status: 403, headers: { "cache-control": "no-store", ...VARY } });
}
