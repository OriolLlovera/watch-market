import "./globals.css";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans" });
export const metadata = { title: "Watch Market", description: "Anuncios de relojes de todo Internet en un solo lugar" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${serif.variable} ${sans.variable}`}><body>{children}</body></html>;
}
