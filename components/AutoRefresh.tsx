"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Mientras el servidor actualiza fuentes en segundo plano, vuelve a pedir los datos cada pocos segundos. */
export default function AutoRefresh({ active, every = 5000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}
