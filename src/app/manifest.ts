import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SuperSoy",
    short_name: "SuperSoy",
    description: "Dashboard penjualan, pelanggan, stok, dan keuangan toko",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#2563eb",
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
