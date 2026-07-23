"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"

export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    QRCode.toCanvas(
      canvas,
      value,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: "L", // lowest ECC -> highest capacity for large SDP payloads
        color: { dark: "#20211f", light: "#f4efe6" },
      },
      (err) => setError(!!err),
    )
  }, [value, size])

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-md bg-muted p-4 text-center text-sm text-muted-foreground"
        style={{ width: size, height: size }}
      >
        A kód túl nagy a QR-hez. Használd a szöveges kód másolását alább.
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="rounded-md"
      style={{ width: size, height: size }}
      aria-label="Csatlakozási QR-kód"
    />
  )
}
