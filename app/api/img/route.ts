import { thumbnail } from "@/lib/images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, src = q.get("u") ?? "";
  const w = Math.min(1600, Math.max(80, parseInt(q.get("w") ?? "640", 10) || 640));
  const buf = await thumbnail(src, w);
  if (buf) return new Response(new Uint8Array(buf), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
  // No se pudo (robots, sharp ausente, error): la foto original, solo si es de un anuncio nuestro.
  const { isKnownImage } = await import("@/lib/connectors/registry");
  return (await isKnownImage(src)) ? Response.redirect(src, 302) : new Response("no", { status: 403 });
}
