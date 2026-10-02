import { Listing } from "@/lib/types";
import { ago, money } from "@/lib/search";
import WatchImage from "./WatchImage";
export default function ListingCard({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group text-left">
      <div className="aspect-[4/5] overflow-hidden bg-wash"><WatchImage l={l} /></div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-xs text-mute">{l.brand}</span>
        <span className="num text-[15px] font-medium">{money(l)}</span>
      </div>
      <h3 className="mt-1 line-clamp-2 font-serif text-[17px] leading-snug decoration-line underline-offset-4 group-hover:underline">{l.title}</h3>
      <p className="mt-1 text-xs text-mute">{l.seller} · {ago(l.postedAt)}</p>
      <p className="mt-2 border-t border-line pt-1.5 text-xs text-mute">{l.source} · {l.country}{l.caseSize ? ` · ${l.caseSize} mm` : ""}</p>
    </button>
  );
}
