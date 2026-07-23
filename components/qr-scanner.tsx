"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"

// Boost contrast + convert to grayscale in-place. Helps jsQR lock onto a
// low-contrast or dimly lit QR code (a common real-world failure).
function boostContrast(data: Uint8ClampedArray, contrast = 1.8) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    let v = (gray - 128) * contrast + 128
    v = v < 0 ? 0 : v > 255 ? 255 : v
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const doneRef = useRef(false)
  const zoomRef = useRef(2)

  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(2)
  const [hardwareZoom, setHardwareZoom] = useState(false)

  zoomRef.current = zoom

  // Try to zoom the camera hardware. If unsupported we fall back to a digital
  // (crop) zoom during scanning + a CSS transform for the preview.
  const applyHardwareZoom = useCallback((z: number) => {
    const track = trackRef.current
    if (!track || typeof track.getCapabilities !== "function") return false
    const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } }
    if (!caps.zoom) return false
    const clamped = Math.min(Math.max(z, caps.zoom.min ?? 1), caps.zoom.max ?? z)
    track
      .applyConstraints({ advanced: [{ zoom: clamped }] } as MediaTrackConstraints)
      .catch(() => {})
    return true
  }, [])

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0] ?? null
        trackRef.current = track

        // Prefer real optical/digital hardware zoom when the device exposes it.
        const hw = applyHardwareZoom(zoomRef.current)
        setHardwareZoom(hw)

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

    function scanImage(ctx: CanvasRenderingContext2D, w: number, h: number): string | null {
      const img = ctx.getImageData(0, 0, w, h)
      // 1) Fast pass on the raw frame.
      let code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })
      if (code?.data) return code.data
      // 2) Contrast-boosted pass, trying both polarities (dark-on-light and
      //    light-on-dark). More robust in poor lighting / on screens.
      boostContrast(img.data)
      code = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })
      return code?.data ?? null
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || doneRef.current) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (vw && vh) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (ctx) {
            // Digital zoom: when hardware zoom isn't available, crop the center
            // region so the QR fills more of the frame -> easier to decode.
            const z = hardwareZoom ? 1 : Math.max(1, zoomRef.current)
            const sw = vw / z
            const sh = vh / z
            const sx = (vw - sw) / 2
            const sy = (vh - sh) / 2
            canvas.width = sw
            canvas.height = sh
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
            const found = scanImage(ctx, sw, sh)
            if (found) {
              doneRef.current = true
              onResult(found)
              return
            }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResult, applyHardwareZoom, hardwareZoom])

  function changeZoom(next: number) {
    setZoom(next)
    if (hardwareZoom) applyHardwareZoom(next)
  }

  // CSS preview scale only needed when we don't have hardware zoom.
  const previewScale = hardwareZoom ? 1 : zoom

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-md border border-border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover transition-transform duration-200"
          style={{ transform: `scale(${previewScale})` }}
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-primary/70" aria-hidden />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => changeZoom(z)}
            aria-pressed={zoom === z}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              zoom === z ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
            }`}
          >
            {z}×
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-center text-sm text-accent-foreground">{error}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Irányítsd a kamerát a másik telefon QR-kódjára</p>
      )}
    </div>
  )
}
