import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard Admin",
    short_name: "Dashboard",
    description: "Dashboard penjualan, pelanggan, dan stok",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#241d15",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
