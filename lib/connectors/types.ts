import { Listing } from "../types";
/** Cada fuente implementa Connector. `access` documenta el método autorizado a usar. */
export interface Connector {
  id: string; name: string; country: string;
  access: "rss" | "api" | "scraping-permitido" | "manual" | "pendiente";
  status: "mock" | "planned" | "active";
  /** `onProgress` recibe los anuncios acumulados para mostrarlos antes de que termine toda la fuente. */
  fetchListings(onProgress?: (partial: Listing[]) => void): Promise<Listing[]>;
}
