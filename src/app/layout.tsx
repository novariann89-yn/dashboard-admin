import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Dashboard Admin",
  description: "Dashboard penjualan, pelanggan, dan stok",
  appleWebApp: {
    capable: true,
    title: "Dashboard Admin",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f0f4f8",
  colorScheme: "light dark",
};

const applyThemeScript = `(function(){try{var m=localStorage.getItem("themeMode")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyThemeScript }} />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
