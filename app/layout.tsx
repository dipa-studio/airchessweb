import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "WiFi Chess — offline P2P sakk",
  description:
    "Telepíthető, offline sakk alkalmazás. Csatlakozz egy másik telefonhoz QR-kóddal, WebRTC-n keresztül — internet nélkül is, akár repülőn.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WiFi Chess",
  },
}

export const viewport: Viewport = {
  themeColor: "#2a2620",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased no-select">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
