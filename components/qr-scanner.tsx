"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.setAttribute("playsinline", "true")
        await video.play()
        tick()
      } catch {
        setError("Nem sikerült elérni a kamerát. Engedélyezd a kamerát, vagy használd a szöveges kód beillesztését.")
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || doneRef.current) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth
        const h = video.videoHeight
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (ctx && w && h) {
          ctx.drawImage(video, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })
          if (code && code.data) {
            doneRef.current = true
            onResult(code.data)
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      doneRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-md border border-border bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-primary/70" aria-hidden />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error ? (
        <p className="text-center text-sm text-accent-foreground">{error}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Irányítsd a kamerát a másik telefon QR-kódjára</p>
      )}
    </div>
  )
}
