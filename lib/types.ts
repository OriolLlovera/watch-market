export type Style = "Diver" | "Dress" | "Chronograph" | "Sport" | "GMT" | "Field" | "Pilot" | "Digital" | "Vintage" | "Military";
export type Currency = "USD" | "EUR" | "GBP" | "NOK" | "SEK" | "DKK" | "CHF" | "AUD" | "CAD";
export type Condition = "Nuevo" | "Como nuevo" | "Usado" | "Vintage" | "Para piezas";
export interface Listing {
  id: string; title: string; description: string;
  brand: string; model: string; reference: string;
  price: number; currency: Currency;
  seller: string; source: string; postedAt: string; country: string;
  condition: Condition; caseSize: number; style: Style; dial: string;
  url: string; images: string[];
  // Datos extra (se rellenan solo si el anuncio los dice): ver lib/connectors/specs.ts
  movement?: string; material?: string; year?: number; contents?: string; waterResistance?: string; freeShipping?: boolean; negotiable?: boolean; dialName?: string;
}
export interface Filters {
  q: string; brands: string[]; model: string; reference: string; min: string; max: string;
  sizes: string[]; styles: string[]; sources: string[]; countries: string[]; conditions: string[];
  movements: string[]; materials: string[]; contents: string[];
}
export type SortKey = "recent" | "priceAsc" | "priceDesc" | "relevance";
