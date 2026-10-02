export type Style = "Diver" | "Dress" | "Chronograph" | "Sport" | "GMT" | "Field" | "Pilot" | "Digital" | "Vintage" | "Military";
export type Condition = "Nuevo" | "Como nuevo" | "Usado" | "Vintage" | "Para piezas";
export interface Listing {
  id: string; title: string; description: string;
  brand: string; model: string; reference: string;
  price: number; currency: "USD" | "EUR" | "GBP";
  seller: string; source: string; postedAt: string; country: string;
  condition: Condition; caseSize: number; style: Style; dial: string;
  url: string; images: string[];
}
export interface Filters {
  q: string; brands: string[]; model: string; reference: string; min: string; max: string;
  sizes: string[]; styles: string[]; sources: string[]; countries: string[]; conditions: string[];
}
export type SortKey = "recent" | "priceAsc" | "priceDesc" | "relevance";
