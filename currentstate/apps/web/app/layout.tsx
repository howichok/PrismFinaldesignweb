import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import LayoutShell from "@/components/LayoutShell";

import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PrismMTR - Minecraft Transit Railway Launcher",
  description:
    "PrismMTR - Optimized launcher for Minecraft Transit Railway. Improved stability and performance for Fabric 1.20.1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var darkMode=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(darkMode){document.documentElement.classList.add('dark-mode');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`}
        </Script>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
