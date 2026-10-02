import { Condition, Listing, Style } from "./types";
import { photosFor } from "./photos";
type T = [string, string, string, Style, number, number, string, string];
const T: T[] = [
  ["Rolex","Day-Date","18038","Dress",36,11500,"#1c1c1c","Sharp lugs, yellow gold, serviced"],
  ["Rolex","Submariner","16610","Diver",40,9800,"#141414","Black dial, Oyster bracelet"],
  ["Rolex","GMT-Master II","16710","GMT",40,12400,"#2a2a2a","Pepsi bezel, box and papers"],
  ["Rolex","Datejust","16233","Dress",36,6900,"#d8d2c0","Two-tone, champagne dial"],
  ["Rolex","Explorer","114270","Field",36,7600,"#101010","Full set, unpolished"],
  ["Rolex","Oyster Perpetual","124300","Sport",41,10200,"#2f5d8a","Blue dial, 2022"],
  ["Omega","Speedmaster Professional","145.022","Chronograph",42,5400,"#161616","Hesalite, cal. 861"],
  ["Omega","Seamaster 300M","2254.50","Diver",41,2900,"#1d3557","Wave dial, bracelet"],
  ["Omega","Seamaster 300","166.024","Vintage",41,6200,"#242424","Tropical dial, 1968"],
  ["Omega","Constellation","168.017","Dress",35,1700,"#c9c3b3","Pie-pan dial, automatic"],
  ["Breitling","Navitimer","A23322","Pilot",41,3900,"#1b1b1b","Slide rule, bracelet"],
  ["Breitling","Superocean","A17364","Diver",44,2800,"#222222","Rubber strap, full kit"],
  ["Tudor","Black Bay 58","79030N","Diver",39,2900,"#111111","2021, box and papers"],
  ["Tudor","Heritage Chrono","70330N","Chronograph",42,2500,"#1a1a1a","Leather strap"],
  ["Seiko","SARB017","SARB017","Dress",38,380,"#1c1c1c","Alpinist-era classic, Cal. 6R15"],
  ["Seiko","Turtle","SRP777","Diver",44,330,"#1a1a1a","Black Series, bracelet"],
  ["Seiko","6139-6002","6139-6002","Vintage",41,760,"#c7a63a","Pogue, original bracelet"],
  ["Seiko","SKX007","SKX007K2","Diver",42,290,"#101010","Jubilee bracelet"],
  ["Citizen","Promaster","BN0150","Diver",44,210,"#151515","Eco-Drive, rubber strap"],
  ["Grand Seiko","Snowflake","SBGA211","Dress",41,5200,"#e4e6e8","Spring Drive, titanium"],
  ["IWC","Pilot Mark XVIII","IW327001","Pilot",40,3600,"#171717","Leather strap, full set"],
  ["Jaeger-LeCoultre","Reverso","Q2518410","Dress",42,4700,"#cfcab8","Gray dial, hand wound"],
  ["Cartier","Tank Must","WSTA0042","Dress",33,2400,"#e8e4d8","Quartz, box and papers"],
  ["Heuer","Carrera","2447N","Vintage",36,5900,"#262626","Panda, Valjoux 72"],
  ["Casio","G-Shock","GW-5000U","Digital",43,380,"#1b1b1b","Made in Japan, full metal"],
  ["Hamilton","Khaki Field","H70455133","Field",38,520,"#6b705c","Mechanical, NATO"],
  ["Panerai","Luminor Base","PAM00112","Military",44,3800,"#0f0f0f","Hand wound, 2010"],
  ["Longines","Hydroconquest","L3.781.4","Sport",41,1100,"#1f3a5f","Ceramic bezel"],
];
const SRC: [string, string][] = [["Reddit","US"],["WatchUSeek","US"],["WatchCrunch","US"],["Rolex Forums","US"],["Omega Forums","US"],["Breitling Source","US"],["Klocksnack","SE"],["Relojes Especiales","ES"],["Uhrforum","DE"],["Timezone","US"],["Watchnet","DE"],["The Watch Forum UK","GB"],["Orologi e Passioni","IT"],["Tidssonen","SE"],["Forum a Montres","FR"],["Seiko & Citizen Watch Forum","US"]];
const SELL = ["BoghossianJewelry","tick_tock_dan","HodinkeeHater","relojero_bcn","uhrmacher_k","vintage_vic","StrapCode","lorenzo_oro","chrono_nils","WristRoll","montres_paul","dialfinder","SwissTimeLtd","u_kalle_w"];
const COND: Condition[] = ["Usado","Usado","Como nuevo","Nuevo","Vintage"];
function rng(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(42);
const pick = <X,>(a: X[]) => a[Math.floor(r() * a.length)];
export const MOCK_LISTINGS: Listing[] = T.flatMap((t, i) => [0, 1, 2].map((k) => {
  const [brand, model, ref, style, size, usd, dial, note] = t;
  const [source, country] = pick(SRC);
  const currency = country === "US" ? "USD" : country === "GB" ? "GBP" : "EUR";
  const fx = { USD: 1, EUR: 0.92, GBP: 0.79 }[currency];
  const price = Math.round((usd * (0.88 + r() * 0.26) * fx) / 10) * 10;
  const vintage = style === "Vintage" || ref.includes(".");
  const year = vintage ? 1962 + Math.floor(r() * 25) : 1995 + Math.floor(r() * 29);
  const condition: Condition = vintage ? "Vintage" : pick(COND);
  const seller = pick(SELL);
  const mins = Math.floor(r() * r() * 60 * 24 * 21) + 5;
  return { id: `m-${i}-${k}`, brand, model, reference: ref, style, caseSize: size, price, currency, source, country, seller, condition,
    dial, title: `${brand} ${model} ${ref} ${year} (${k === 0 ? "Serviced" : k === 1 ? "Full set" : "Excellent condition"})`,
    description: `${brand} ${model} ref. ${ref}. ${note}. Case ${size} mm. ${condition}. Shipping worldwide, trades considered.`,
    postedAt: new Date(Date.now() - mins * 60000).toISOString(), url: `https://example.com/${source.toLowerCase().replace(/\W+/g, "-")}/${i}-${k}`, images: photosFor(brand, model) } as Listing;
}));
