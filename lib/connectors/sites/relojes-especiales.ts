import type { Listing } from "../../types";
import { type Currency } from "../parse";
import { stripHtml } from "../parse";

/** Lógica específica de Relojes Especiales (el precio va en la ficha, no en el título). Código original sin cambios. */
/**
 * Extrae el precio de la ficha de Relojes Especiales.
 *
 * Ejemplos:
 * Precio (o valor de cambio): 125€
 * Precio (o valor de cambio): 125 €
 * Precio (o valor de cambio): 1.250€
 * Precio (o valor de cambio): 125 EUR
 */
export function findRelojesEspecialesPrice(
  text: string
): { price: number; currency: Currency } | null {
  const normalized = decodeHtmlEntities(text)
    .replace(/\s+/g, " ")
    .trim();

  /*
   * Primero buscamos específicamente la palabra "Precio".
   *
   * Permitimos:
   * - :
   * - .
   * - (o cambio)
   * - (o Cambio)
   * - markdown **
   * - texto como "Precio de"
   *
   * Ejemplos:
   * Precio 125€
   * Precio: 115€
   * Precio. 4000
   * Precio: (o Cambio) 6.400€
   * Precio: **4,250 €
   * Precio (o cambio): Precio de 4.550 euros
   */

  const pricePatterns = [
    // Precio: (o Cambio) 6.400€
    /precio\s*(?:\([^)]*\))?\s*[:.]?\s*(?:\*+\s*)*(?:precio\s+de\s+)?([0-9][0-9.,]*)\s*(€|eur|euros?)?/i,

    // Precio (o cambio): Precio de 4.550 euros
    /precio\s*(?:\([^)]*\))?\s*[:.]?\s*(?:\*+\s*)*precio\s+de\s+([0-9][0-9.,]*)\s*(€|eur|euros?)?/i,

    // Caso especialmente permisivo: hay texto entre "Precio" y el número
    /precio\b[^0-9]{0,80}([0-9][0-9.,]*)\s*(€|eur|euros?|e\.?\s*i\.?)?/i,
  ];

  for (const pattern of pricePatterns) {
    const match = normalized.match(pattern);

    if (!match) continue;

    const price = parseSpanishPrice(match[1]);

    if (price !== null) {
      return {
        price,
        currency: "EUR",
      };
    }
  }

  return null;
}

/**
 * Decodifica entidades HTML que pueden aparecer
 * en el texto extraído del foro.
 *
 * Ejemplos:
 *
 * &#34;  -> "
 * &#32;  -> espacio
 * &#8364; -> €
 * &#x20AC; -> €
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(
      /&#x([0-9a-f]+);?/gi,
      (_, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(
      /&#([0-9]+);?/g,
      (_, decimal: string) =>
        String.fromCodePoint(parseInt(decimal, 10))
    )
    .replace(/&euro;/gi, "€")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseSpanishPrice(raw: string): number | null {
  let value = raw.trim();

  if (!value) return null;

  /*
   * Formatos españoles:
   *
   * 6.400       -> 6400
   * 14.000      -> 14000
   * 4.550       -> 4550
   * 4,250       -> 4250
   * 125         -> 125
   *
   * También soportamos:
   * 1.250,50    -> 1250.50
   * 1,250.50    -> 1250.50
   */

  if (value.includes(".") && value.includes(",")) {
    const lastDot = value.lastIndexOf(".");
    const lastComma = value.lastIndexOf(",");

    if (lastComma > lastDot) {
      // 1.250,50
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,250.50
      value = value.replace(/,/g, "");
    }
  } else if (value.includes(".")) {
    const parts = value.split(".");

    if (
      parts.length > 2 ||
      (parts.length === 2 && parts[1].length === 3)
    ) {
      // 6.400 / 14.000 / 1.250.000
      value = value.replace(/\./g, "");
    }
  } else if (value.includes(",")) {
    const parts = value.split(",");

    if (parts.length === 2 && parts[1].length === 3) {
      // 4,250
      value = value.replace(",", "");
    } else {
      // 125,50
      value = value.replace(",", ".");
    }
  }

  const price = Number(value);

  if (!Number.isFinite(price)) {
    return null;
  }

  // Evita capturar números que claramente no son precios.
  if (price < 20 || price > 2_000_000) {
    return null;
  }

  return Math.round(price);
}

/**
 * Convierte números escritos con formato español:
 *
 * 150      -> 150
 * 2.895    -> 2895
 * 2.895,50 -> 2895.50
 * 150,50   -> 150.50
 */


const RE_BRANDS = [
  "Grand Seiko",
  "Jaeger-LeCoultre",
  "Jaeger LeCoultre",
  "TAG Heuer",
  "Audemars Piguet",
  "Patek Philippe",
  "Vacheron Constantin",
  "Universal Geneve",
  "Christopher Ward",
  "Raymond Weil",
  "Rolex",
  "Omega",
  "Tudor",
  "Seiko",
  "Citizen",
  "Breitling",
  "IWC",
  "Cartier",
  "Heuer",
  "Casio",
  "Hamilton",
  "Panerai",
  "Longines",
  "Zenith",
  "Nomos",
  "Sinn",
  "Oris",
  "Tissot",
  "Bulova",
  "Orient",
  "Hublot",
  "Blancpain",
  "Baltic",
  "Squale",
  "Doxa",
  "Timex",
  "Marathon",
  "Glycine",
  "Certina",
  "Rado",
  "Montblanc",
  "Junghans",
  "Laco",
  "Stowa",
  "Farer",
  "Zodiac",
  "Vostok",
  "Enicar",
  "Eterna",
  "OceanX",
  "Q Timex",
  "Qimei",
  "Maurice Lacroix",
  "Alpina",
  "Bell & Ross",
  "Bell&Ross",
  "Perrelet",
  "Edox",
  "Seagull",
  "Swatch",
  "Bultaco",
  "Ancre",
  "Cortebert",
  "Camy",
];

function findREBrand(title: string): string {
  const found = RE_BRANDS.find((brand) => {
    const escaped = brand
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/[-\s]+/g, "[-\\s]+");

    return new RegExp(
      `(^|[^a-z])${escaped}([^a-z]|$)`,
      "i"
    ).test(title);
  });

  return found ?? "—";
}

function findREReference(title: string): string {
  const matches =
    title.match(
      /\b[A-Z]{1,5}[-]?[A-Z0-9]{2,12}(?:[-][A-Z0-9]{1,8})?\b/g
    ) ?? [];

  const ignored = new Set([
    "NOS",
    "GMT",
    "DIVER",
    "AUTO",
    "AUTOMATIC",
    "VINTAGE",
    "BLACK",
    "BLUE",
    "RED",
    "LIMITED",
    "EDITION",
  ]);

  const candidate = matches.find(
    (value) =>
      value.length >= 4 &&
      !ignored.has(value.toUpperCase()) &&
      !/^19\d{2}$/.test(value) &&
      !/^20\d{2}$/.test(value)
  );

  if (candidate) return candidate;
  // Referencias que empiezan por número (Rolex 16610, Tudor 79030N, Omega 145.022): el patrón anterior no las ve.
  const numeric = (title.match(/\b(?=[A-Za-z0-9.\-]*\d)[A-Za-z]{0,4}\d[A-Za-z0-9.\-]{2,11}\b/g) ?? []).find(
    (t) => t.length >= 4 && !/^(19|20)\d{2}$/.test(t) && !/^\d{2}(\.\d)?mm$/i.test(t)
  );
  return numeric ?? "—";
}


export function parseRelojesEspeciales(
  title: string,
  body: string,
  price: { price: number; currency: Currency }
): Omit<
  Listing,
  | "id"
  | "seller"
  | "source"
  | "country"
  | "postedAt"
  | "url"
  | "images"
> {
  const clean = title
    .replace(/\s+/g, " ")
    .trim();

  const brand = findREBrand(clean);
  const reference = findREReference(clean);

  const year =
    clean.match(
      /\b(19[4-9]\d|20[0-2]\d)\b/
    )?.[1];

  const sizeMatch = (
    clean +
    " " +
    body
  ).match(
    /\b(\d{2}(?:\.\d)?)\s?mm\b/i
  );

  const caseSize =
    sizeMatch &&
    Number(sizeMatch[1]) >= 20 &&
    Number(sizeMatch[1]) <= 60
      ? Number(sizeMatch[1])
      : 0;

  const context = (
    clean +
    " " +
    body.slice(0, 1000)
  ).toLowerCase();

  let condition: Listing["condition"] =
    "Usado";

  if (
    /parts|for repair|not working|spares|non[- ]?running/i.test(
      context
    )
  ) {
    condition = "Para piezas";
  } else if (
    /\b(bnib|brand new|unworn|nos|new in box)\b/i.test(
      context
    )
  ) {
    condition = "Nuevo";
  } else if (
    /\b(like new|mint|lnib|nearly new|excellent|as new)\b/i.test(
      context
    )
  ) {
    condition = "Como nuevo";
  } else if (
    /vintage/i.test(context) ||
    (year && Number(year) < 1985)
  ) {
    condition = "Vintage";
  }

  let style: Listing["style"] = "Sport";

  if (
    /diver|submariner|seamaster|skx|turtle|black bay|pelagos|superocean|planet ocean|aquaracer|prospex|hydroconquest|promaster/i.test(
      clean
    )
  ) {
    style = "Diver";
  } else if (
    /gmt|world ?timer/i.test(clean)
  ) {
    style = "GMT";
  } else if (
    /chrono|speedmaster|daytona|carrera|navitimer|moonwatch/i.test(
      clean
    )
  ) {
    style = "Chronograph";
  } else if (
    /pilot|flieger|aviator|navitimer|big crown/i.test(
      clean
    )
  ) {
    style = "Pilot";
  } else if (
    /field|explorer|khaki|mil-?spec/i.test(
      clean
    )
  ) {
    style = "Field";
  } else if (
    /military|luminor|\bw10\b|dirty dozen/i.test(
      clean
    )
  ) {
    style = "Military";
  } else if (
    /g-?shock|digital|f-91w/i.test(clean)
  ) {
    style = "Digital";
  } else if (
    /dress|datejust|day-date|reverso|tank|calatrava|snowflake|constellation|pie-?pan/i.test(
      clean
    )
  ) {
    style = "Dress";
  }

  let dial = "#1c1c1c";

  if (/\bblack\b/i.test(clean)) {
    dial = "#141414";
  } else if (/\bblue\b/i.test(clean)) {
    dial = "#2f5d8a";
  } else if (/\bgreen\b/i.test(clean)) {
    dial = "#1f4d3a";
  } else if (
    /\b(white|panda|cream)\b/i.test(clean)
  ) {
    dial = "#e8e4d8";
  } else if (
    /\b(silver|snowflake)\b/i.test(clean)
  ) {
    dial = "#e4e6e8";
  } else if (
    /\b(champagne|gold)\b/i.test(clean)
  ) {
    dial = "#c7a63a";
  } else if (
    /\b(grey|gray)\b/i.test(clean)
  ) {
    dial = "#6b6f73";
  } else if (/\bred\b/i.test(clean)) {
    dial = "#8a2a2a";
  }

  let model = clean;

  if (brand !== "—") {
    model = model.replace(
      new RegExp(
        brand.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        ),
        "i"
      ),
      " "
    );
  }

  if (reference !== "—") {
    model = model.replace(reference, " ");
  }

  model = model
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");

  if (!model) {
    model =
      reference !== "—"
        ? reference
        : clean;
  }

  return {
    title: clean,
    description:
      body.slice(0, 600) || clean,
    brand,
    model,
    reference,
    price: price.price,
    currency: price.currency,
    condition,
    caseSize,
    style,
    dial,
  };
}

