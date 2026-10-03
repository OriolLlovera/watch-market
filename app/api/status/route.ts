import { NextResponse } from "next/server";
import { status } from "@/lib/connectors/registry";
export const dynamic = "force-dynamic";
/** Diagnóstico rápido: abre /api/status en tu sitio para ver si hay datos guardados y desde cuándo. */
export async function GET() {
  return NextResponse.json(await status(), { headers: { "cache-control": "no-store" } });
}
