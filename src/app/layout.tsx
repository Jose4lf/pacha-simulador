import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PACHA Simulador · Marketing de Helados",
  description: "Simulador tipo videojuego del juego de marketing Markestrat: industria de helados en Bolivia. 5 segmentos, 3 canales, 15 estudios de mercado y proyectos de I+D del Año 0 al 10.",
  keywords: ["PACHA", "Markestrat", "simulador", "marketing", "helados", "Bolivia", "videojuego"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Aplica el tema guardado antes del primer pintado para evitar parpadeo.
  const scriptTema = `try{if(localStorage.getItem('pacha_tema')==='tinta')document.documentElement.dataset.theme='tinta'}catch(e){}`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
