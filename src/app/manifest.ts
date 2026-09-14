import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toko Mas Andik",
    short_name: "Toko Andik",
    description: "Dashboard member dan pembelian",
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
