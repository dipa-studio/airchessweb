import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"

// A signaling payload is the local SDP description that must reach the peer.
export type SignalPayload = {
  t: "o" | "a" // offer | answer
  s: string // sdp
}

const PREFIX = "WC1:" // WiFi Chess signaling v1 — lets the scanner reject foreign QR codes.

export function encodeSignal(desc: RTCSessionDescriptionInit): string {
  const payload: SignalPayload = {
    t: desc.type === "offer" ? "o" : "a",
    s: desc.sdp ?? "",
  }
  return PREFIX + compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeSignal(code: string): { type: "offer" | "answer"; sdp: string } | null {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  try {
    const json = decompressFromEncodedURIComponent(trimmed.slice(PREFIX.length))
    if (!json) return null
    const payload = JSON.parse(json) as SignalPayload
    if ((payload.t !== "o" && payload.t !== "a") || typeof payload.s !== "string") return null
    return { type: payload.t === "o" ? "offer" : "answer", sdp: payload.s }
  } catch {
    return null
  }
}
