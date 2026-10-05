import { Images, MapPin } from "lucide-react";
import { Listing } from "@/lib/types";
import { ago, money, toUsd } from "@/lib/search";
import WatchImage from "./WatchImage";

const RECENT_MS = 48 * 3600e3;
export default function ListingCard({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  const recent = Date.now() - +new Date(l.postedAt) < RECENT_MS;
  const tags = [l.contents, l.movement, l.material, l.freeShipping ? "Envío incl." : undefined].filter(Boolean).slice(0, 3) as string[];
  return (
    <button onClick={onOpen} className="group block w-full self-start text-left">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-wash ring-1 ring-line transition group-hover:ring-ink/40">
        <WatchImage l={l} className="transition duration-500 group-hover:scale-[1.04]" />
        <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-paper/90 px-2 py-0.5 text-[11px] font-medium text-ink backdrop-blur">{l.source}</span>
        {recent && <span suppressHydrationWarning className="absolute bottom-2 left-2 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-paper">Reciente</span>}
        {l.images.length > 1 && <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[11px] text-paper"><Images size={11} strokeWidth={1.75} />{l.images.length}</span>}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-mute">{l.brand}</span>
          <span className="num shrink-0 text-base font-semibold">{money(l)}</span>
        </div>
        <h3 className="mt-1 line-clamp-2 font-serif text-[17px] leading-snug transition-colors group-hover:text-accent">{l.title}</h3>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-mute">
          <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={12} strokeWidth={1.5} className="shrink-0" /><span className="truncate">{l.country} · {l.condition}{l.caseSize ? ` · ${l.caseSize} mm` : ""}{l.year ? ` · ${l.year}` : ""}</span></span>
          {l.currency !== "USD" && <span className="num hidden shrink-0 sm:inline">≈ ${Math.round(toUsd(l)).toLocaleString("es-ES")}</span>}
        </div>
        {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="rounded border border-line px-1.5 py-0.5 text-[11px] leading-4 text-mute">{t}</span>)}</div>}
        <p suppressHydrationWarning className="mt-1.5 truncate text-xs text-mute">{l.seller} · {ago(l.postedAt)}</p>
      </div>
    </button>
  );
}
