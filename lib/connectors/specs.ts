import type { Listing } from "../types";

/** Datos extra de la ficha, sacados del título y del texto del anuncio (ES / EN / DE / NO). Todo es opcional: solo se rellena lo que el texto dice claro. */
export type Specs = Partial<Pick<Listing, "movement" | "material" | "year" | "contents" | "waterResistance" | "freeShipping" | "negotiable" | "dialName">>;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
type Hit = [string, RegExp];
/** De los candidatos, el que aparece antes en el texto. */
const earliest = (t: string, cands: Hit[]): string | undefined => {
  let best: string | undefined, at = Infinity;
  for (const [label, re] of cands) { const i = t.search(re); if (i >= 0 && i < at) { at = i; best = label; } }
  return best;
};
/** El título manda sobre el cuerpo: se busca primero allí. */
const pick = (title: string, body: string, cands: Hit[]) => earliest(title, cands) ?? earliest(body, cands);

const MOVEMENT: Hit[] = [
  ["Solar", /\b(solar|eco-?drive|tough solar)\b/],
  ["Cinético", /\b(kinetic|cinetic[oa])\b/],
  ["Spring Drive", /spring ?drive/],
  ["Automático", /\b(automatic|automatico|automatik|automat|automatisk|self-?winding|auto-?winding|perpetual)\b/],
  ["Manual", /\b(hand[- ]?wound|hand[- ]?winding|manual[- ]?wind(ing)?|handaufzug|cuerda manual|carga manual|cargado manual|manuell|manuelt)\b/],
  ["Cuarzo", /\b(quartz|cuarzo|quarz|kvarts|quarzo|qz)\b/],
];

// "bisel de oro", "gold crown"...: el oro es un detalle, no la caja.
const GOLD_DETAIL = /(?:(?:18|14|10|9)\s?(?:k|kt|ct)\s?)?\b(?:gold|oro|gull)\s+(?:de\s+)?(?:bezel|bisel|lunette|crown|corona|krone|markers?|index|hands|agujas|insert|screws|tornillos|buckle|hebilla|clasp|detalles?|details?|accents?)\b/g;
function material(raw: string): string | undefined {
  const t = raw.replace(GOLD_DETAIL, " ");
  const plated = /plated|chapad[oa]|dorad[oa]|vergoldet|forgylt|gold[- ]?filled|\bsgp\b|\brgp\b|\bgp\b/.test(t);
  const gold = /\b(18|14|9|10)\s?(kt|ct|quilates|karat|carat)\b|(gold|oro|gull|caja|case|kasse)\W{1,4}(18|14|10)\s?k\b|\b(18|14|10)\s?k\s?(gold|oro|gull|yg|rg|wg)\b|\boro (amarillo|rosa|blanco|macizo)\b|\boro (y|e|\/) acero\b|\bacero (y|e|\/) oro\b|\b(yellow|rose|white|solid|pink) gold\b|\b(massiv|rose|gelb|weiss)gold\b/.test(t);
  const steel = /\b(acero|stainless|steel|edelstahl|rustfritt|stal|inox|acier)\b/.test(t);
  if (plated) return "Chapado en oro";
  if (gold && steel && /two[- ]?tone|bi-?color|rolesor|steel (and|&|\/|\+) gold|acero (y|e|\/) oro|oro (y|e|\/) acero|stahl.{0,3}gold|stal og gull/.test(t)) return "Bicolor";
  if (gold) return "Oro";
  if (/\btitan(io|ium|e)?\b/.test(t)) return "Titanio";
  if (/\b(ceramic|ceramica|keramik|keramikk)\b/.test(t)) return "Cerámica";
  if (/\b(bronz[eo]|bronce|bronse)\b/.test(t)) return "Bronce";
  if (steel) return "Acero";
}

const YEAR = "(19[3-9]\\d|20[0-2]\\d)";
// Un año solo cuenta con contexto fuerte ("año: 1995", "Baujahr 1972", "produced 1980", "(2016)"). Sin él suele ser el nombre del modelo
// ("Luminor 1950", "modelo: 1963"), una fecha de compra ("comprado en marzo del 2026", "año de compra: circa 2000") o de una garantía.
// "de 1931" (p. ej. "Reverso original de 1931") solo vale en el título y solo para años de época (hasta 1999).
const STRONG = new RegExp(`(?:\\bano\\b|\\byear\\b|baujahr|\\bbj\\b|produced(?: in)?|fabricado(?: en)?|arsmodell)\\W{0,3}${YEAR}\\b|\\(${YEAR}\\)`);
const WEAK_TITLE = new RegExp(`\\b(?:de|del|from)\\s${YEAR}\\b`);
function year(title: string, body: string): number | undefined {
  const strong = (t: string) => { const m = t.match(STRONG), v = m?.[1] ?? m?.[2]; return v && +v <= 2026 ? +v : undefined; };
  const w = title.match(WEAK_TITLE), weak = w && +w[1] <= 1999 ? +w[1] : undefined;
  return strong(title) ?? weak ?? strong(body);
}

const ONLY = /\b(watch only|only (the )?watch|just (the )?watch|head only|solo (el )?reloj|solo la unidad|nur (die )?uhr|kun (selve )?klokken?|no box|sin caja|sans boite|ohne box|uten eske|no papers|without box)\b/;
const FULL = /\b(full[- ]?set|full[- ]?kit|complete set|box (and|&|\+|y|und|og|en) (papers?|documents?|docs|papeles|documentacion|papiere|papirer|papieren)|caja y (papeles|documentacion)|b ?& ?p|bnp|komplett(es)? set(t)?|alles dabei|boks og papirer|eske og papirer|boite et papiers)\b/;
const PARTIAL = /\b(with box|con caja|con papeles|papers only|box only|mit box|med eske|med boks|estuche original|original box|caja original|warranty card)\b/;

const COLORS: [string, string][] = [
  ["Negra", "black|negr[ao]|schwarz\\w*|svart"], ["Azul", "blue|azul|blau\\w*|bla"], ["Verde", "green|verde|grun\\w*|gron"],
  ["Blanca", "white|blanc[ao]|weiss\\w*|hvit"], ["Plateada", "silver|platead[ao]|silber\\w*|solv\\w*|plata"], ["Champán", "champagne|champan"],
  ["Gris", "gr[ae]y|gris|grau\\w*"], ["Roja", "red|roj[ao]|rot\\w*|rod"], ["Salmón", "salmon|lachs\\w*|laks"], ["Marfil", "ivory|cream|crema|marfil|elfenbein"],
  ["Marrón", "brown|marron|braun\\w*|brun"], ["Naranja", "orange|naranja"], ["Dorada", "gold|golden|dorad[ao]|gull"],
];
const DIALW = "(?:dial|esfera|zifferblatt|urtavle|wijzerplaat|cadran|quadrante)";
const DIAL: Hit[] = COLORS.map(([label, w]) => [label, new RegExp(`\\b(?:${w})\\W{0,3}${DIALW}\\b|\\b${DIALW}\\W{0,3}(?:de color\\W{0,2}|color\\W{0,2})?(?:${w})\\b`)]);

export function extractSpecs(title: string, body = ""): Specs {
  const T = fold(title), B = fold(body.slice(0, 2000)), A = `${T} ${B}`;
  const out: Specs = {};
  const movement = pick(T, B, MOVEMENT); if (movement) out.movement = movement;
  const mat = material(A); if (mat) out.material = mat;
  const y = year(T, B); if (y) out.year = y;
  const contents = ONLY.test(A) ? "Solo reloj" : FULL.test(A) ? "Full set" : PARTIAL.test(A) ? "Caja o papeles" : undefined; if (contents) out.contents = contents;
  const dial = pick(T, B, DIAL); if (dial) out.dialName = dial;
  const atm = A.match(/\b(\d{1,3})\s?(atm|bar)\b/), m = A.match(/\b(30|50|60|100|120|150|200|300|500|600|1000|1200|2000)\s?(?:m|meters?|metres?|metros)\b(?!m)/);
  if (atm) out.waterResistance = `${+atm[1] * 10} m`; else if (m) out.waterResistance = `${m[1]} m`;
  if (/\b(envio (incluido|gratis|gratuito)|portes (incluidos|gratis|gratuitos)|gastos de envio incluidos|free (worldwide )?(shipping|postage|delivery)|shipping (is )?(included|incl\.?)|postage (is )?included|incl(uding|\.)? (shipping|postage)|versand (inklusive|inkl\.?|kostenlos|frei)|inkl\.? versand|kostenloser versand|frakt (er )?(inkludert|inkl\.?)|fri frakt|gratis frakt|ships? free|shipped free)\b/.test(A)) out.freeShipping = true;
  if (/\b(negociable|negociables|admito ofertas|acepto ofertas|negotiable|obo|or best offer|best offer|offers? (welcome|considered)|verhandelbar|vb|verhandlungsbasis|forhandlingsbart|pris kan diskuteres|pkd)\b/.test(A)) out.negotiable = true;
  return out;
}
