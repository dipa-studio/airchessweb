import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WiFi Chess — offline P2P sakk",
    short_name: "WiFi Chess",
    description:
      "Offline, telepíthető sakk. Csatlakozz QR-kóddal egy másik telefonhoz és játssz WebRTC-n keresztül, internet nélkül.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2a2620",
    theme_color: "#2a2620",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
