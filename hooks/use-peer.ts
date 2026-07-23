"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { decodeSignal, encodeSignal } from "@/lib/signal"

export type PeerStatus =
  | "idle"
  | "offer-ready" // host: offer generated, show QR, wait to scan answer
  | "answer-ready" // guest: answer generated, show QR to host
  | "connecting"
  | "connected"
  | "failed"

export type PeerRole = "host" | "guest" | null

// Local-first ICE. Host + mDNS candidates cover the fully-offline case (same
// WiFi / hotspot, no internet). The public STUN servers are only reachable
// when the internet is available; they add server-reflexive candidates so the
// handshake also succeeds across different networks or when mDNS is blocked
// (common on public WiFi with client isolation). Offline behaviour is
// unchanged — unreachable STUN servers are simply skipped by the ICE agent.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
}

// If the handshake never completes we surface a failure instead of hanging on
// the "waiting to connect" screen forever.
const CONNECT_TIMEOUT_MS = 25000

function waitForIce(pc: RTCPeerConnection, timeoutMs = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve()
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check)
      resolve()
    }
    const check = () => {
      if (pc.iceGatheringState === "complete") done()
    }
    pc.addEventListener("icegatheringstatechange", check)
    // Fallback: resolve after a timeout with whatever candidates we have.
    setTimeout(done, timeoutMs)
  })
}

export function usePeer(onMessage: (data: unknown) => void) {
  const [status, setStatus] = useState<PeerStatus>("idle")
  const [role, setRole] = useState<PeerRole>(null)
  const [localCode, setLocalCode] = useState<string>("")

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  // Start a timeout once the handshake is complete. If the data channel never
  // opens, flip to "failed" so the UI can show a retry instead of hanging.
  const startWatchdog = useCallback(() => {
    clearWatchdog()
    watchdogRef.current = setTimeout(() => {
      setStatus((s) => (s === "connected" ? s : "failed"))
    }, CONNECT_TIMEOUT_MS)
  }, [clearWatchdog])

  const wireChannel = useCallback(
    (dc: RTCDataChannel) => {
      dcRef.current = dc
      dc.onopen = () => {
        clearWatchdog()
        setStatus("connected")
      }
      dc.onclose = () => setStatus((s) => (s === "connected" ? "failed" : s))
      dc.onmessage = (e) => {
        try {
          onMessageRef.current(JSON.parse(e.data))
        } catch {
          /* ignore malformed */
        }
      }
    },
    [clearWatchdog],
  )

  const attachConnState = useCallback((pc: RTCPeerConnection) => {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus((s) => (s === "connected" ? "failed" : s))
      }
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        setStatus((s) => (s === "connected" ? s : "failed"))
      }
    }
  }, [])

  // HOST: create the offer to be shown as a QR code.
  const createHost = useCallback(async () => {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    pcRef.current = pc
    attachConnState(pc)
    const dc = pc.createDataChannel("game", { ordered: true })
    wireChannel(dc)
    setRole("host")
    setStatus("connecting")
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIce(pc)
    setLocalCode(encodeSignal(pc.localDescription!))
    setStatus("offer-ready")
  }, [attachConnState, wireChannel])

  // GUEST: consume the host offer (scanned) and produce an answer QR code.
  const joinWithOffer = useCallback(
    async (scanned: string): Promise<boolean> => {
      const decoded = decodeSignal(scanned)
      if (!decoded || decoded.type !== "offer") return false
      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc
      attachConnState(pc)
      pc.ondatachannel = (e) => wireChannel(e.channel)
      setRole("guest")
      setStatus("connecting")
      await pc.setRemoteDescription({ type: "offer", sdp: decoded.sdp })
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForIce(pc)
      setLocalCode(encodeSignal(pc.localDescription!))
      setStatus("answer-ready")
      // Guest is now waiting for the host to scan back — arm the watchdog.
      startWatchdog()
      return true
    },
    [attachConnState, wireChannel, startWatchdog],
  )

  // HOST: consume the guest answer (scanned) to complete the handshake.
  const acceptAnswer = useCallback(async (scanned: string): Promise<boolean> => {
    const decoded = decodeSignal(scanned)
    if (!decoded || decoded.type !== "answer") return false
    const pc = pcRef.current
    if (!pc) return false
    setStatus("connecting")
    await pc.setRemoteDescription({ type: "answer", sdp: decoded.sdp })
    // Handshake complete on the host side — arm the watchdog.
    startWatchdog()
    return true
  }, [startWatchdog])

  const send = useCallback((data: unknown) => {
    const dc = dcRef.current
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  const reset = useCallback(() => {
    clearWatchdog()
    dcRef.current?.close()
    pcRef.current?.close()
    dcRef.current = null
    pcRef.current = null
    setStatus("idle")
    setRole(null)
    setLocalCode("")
  }, [clearWatchdog])

  useEffect(() => {
    return () => {
      clearWatchdog()
      dcRef.current?.close()
      pcRef.current?.close()
    }
  }, [clearWatchdog])

  return { status, role, localCode, createHost, joinWithOffer, acceptAnswer, send, reset }
}
