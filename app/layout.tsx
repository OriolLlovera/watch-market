import "./globals.css";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
export const metadata = { title: "Watch Market — relojes de segunda mano de foros especializados", description: "Anuncios de relojes de varios foros especializados en un solo buscador, con enlace al anuncio original." };
// Aplica el tema guardado (o el del sistema) antes de pintar, para evitar el parpadeo claro→oscuro.
const THEME = `try{var t=localStorage.getItem('wm-theme');document.documentElement.classList.toggle('dark',t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${serif.variable} ${sans.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body>{children}</body>
    </html>
  );
}
