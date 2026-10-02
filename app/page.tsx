import Market from "@/components/Market";
import AutoRefresh from "@/components/AutoRefresh";
import { getSnapshot } from "@/lib/connectors/registry";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { listings, refreshing } = await getSnapshot(); // inmediato: nunca espera al scraping
  return (<><Market listings={listings} refreshing={refreshing} /><AutoRefresh active={refreshing} /></>);
}
