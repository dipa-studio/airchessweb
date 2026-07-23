"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Square } from "chess.js"
import { usePeer } from "@/hooks/use-peer"
import { useChessGame, type Move } from "@/hooks/use-chess-game"
import { GameView } from "@/components/game-view"
import { QrCode } from "@/components/qr-code"
import { QrScanner } from "@/components/qr-scanner"

type Screen = "home" | "host" | "join"
type Color = "w" | "b"

// Messages exchanged over the data channel.
type Msg =
  | { k: "init"; guestColor: Color }
  | { k: "move"; m: Move }
  | { k: "reset" }
  | { k: "resign" }

export function AppRoot() {
  const [screen, setScreen] = useState<Screen>("home")
  const [hostStep, setHostStep] = useState<"setup" | "offer" | "scan">("setup")
  const [joinStep, setJoinStep] = useState<"scan" | "answer">("scan")
  const [hostColor, setHostColor] = useState<Color | "random">("w")
  const [myColor, setMyColor] = useState<Color | null>(null)
  const [resignedBy, setResignedBy] = useState<"me" | "them" | null>(null)
  const [copied, setCopied] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const game = useChessGame()
  const gameRef = useRef(game)
  gameRef.current = game
  const myColorRef = useRef<Color | null>(null)
  myColorRef.current = myColor

  const handleMessage = useCallback((raw: unknown) => {
    const data = raw as Msg
    if (!data || typeof data !== "object") return
    switch (data.k) {
      case "init":
        setMyColor(data.guestColor)
        break
      case "move":
        gameRef.current.applyRemoteMove(data.m)
        break
      case "reset":
        gameRef.current.reset()
        setResignedBy(null)
        break
      case "resign":
        setResignedBy("them")
        break
    }
  }, [])

  const peer = usePeer(handleMessage)
  const peerRef = useRef(peer)
  peerRef.current = peer

  // When the host connects, assign colors and inform the guest.
  useEffect(() => {
    if (peer.status !== "connected") return
    if (peer.role === "host") {
      const resolved: Color = hostColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : hostColor
      setMyColor(resolved)
      const guestColor: Color = resolved === "w" ? "b" : "w"
      // Small delay ensures the channel is fully ready on both sides.
      setTimeout(() => peerRef.current.send({ k: "init", guestColor }), 80)
    }
  }, [peer.status, peer.role, hostColor])

  const connected = peer.status === "connected"
  const failed = peer.status === "failed"

  // ---- Actions ----
  const startHost = useCallback(async () => {
    setHostStep("offer")
    await peer.createHost()
  }, [peer])

  const onScanAnswer = useCallback(
    async (text: string) => {
      const ok = await peer.acceptAnswer(text)
      if (!ok) {
        setScanError("Érvénytelen válaszkód. Próbáld újra.")
      } else {
        setScanError(null)
        setHostStep("offer")
      }
    },
    [peer],
  )

  const onScanOffer = useCallback(
    async (text: string) => {
      const ok = await peer.joinWithOffer(text)
      if (!ok) {
        setScanError("Érvénytelen QR / kód. Ez nem egy WiFi Chess meghívó.")
      } else {
        setScanError(null)
        setJoinStep("answer")
      }
    },
    [peer],
  )

  const doMove = useCallback(
    (from: Square, to: Square) => {
      const mv = gameRef.current.tryMove(from, to)
      if (mv) peerRef.current.send({ k: "move", m: mv })
    },
    [],
  )

  const doNewGame = useCallback(() => {
    gameRef.current.reset()
    setResignedBy(null)
    peerRef.current.send({ k: "reset" })
  }, [])

  const doResign = useCallback(() => {
    peerRef.current.send({ k: "resign" })
    setResignedBy("me")
  }, [])

  const leave = useCallback(() => {
    peer.reset()
    gameRef.current.reset()
    setMyColor(null)
    setResignedBy(null)
    setScreen("home")
    setHostStep("setup")
    setJoinStep("scan")
    setScanError(null)
  }, [peer])

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(peer.localCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [peer.localCode])

  // ---- Render: in-game ----
  if (connected && myColor) {
    return (
      <GameView
        fen={game.fen}
        myColor={myColor}
        status={game.status}
        lastMove={game.lastMove}
        connected={connected}
        resignedBy={resignedBy}
        legalMovesFrom={game.legalMovesFrom}
        onMove={doMove}
        onNewGame={doNewGame}
        onResign={doResign}
        onLeave={leave}
      />
    )
  }

  if (connected && !myColor) {
    return (
      <Centered>
        <p className="text-muted-foreground">Színek egyeztetése…</p>
      </Centered>
    )
  }

  // ---- Render: home ----
  if (screen === "home") {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-card">
              <span className="text-5xl" style={{ color: "var(--primary)" }} aria-hidden>
                {"\u265E\uFE0E"}
              </span>
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight">WiFi Chess</h1>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Két telefon, egy tábla — internet nélkül. Csatlakozz QR-kóddal ugyanazon a WiFi-n vagy hotspoton
              keresztül, és sakkozz akár repülőn is.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setScreen("host")
                setHostStep("setup")
              }}
              className="w-full rounded-md bg-primary py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
            >
              Játék indítása
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen("join")
                setJoinStep("scan")
                setScanError(null)
              }}
              className="w-full rounded-md bg-card py-4 text-base font-semibold text-card-foreground transition active:scale-[0.98]"
            >
              Csatlakozás játékhoz
            </button>
          </div>

          <div className="rounded-md border border-border bg-card/50 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Teljesen offline.</span> Az eszközök közvetlenül
              (WebRTC) beszélgetnek egymással — nincs szükség szerverre vagy internetre. Add hozzá a
              kezdőképernyődhöz a telepítéshez.
            </p>
          </div>
        </div>
      </Centered>
    )
  }

  // ---- Render: host ----
  if (screen === "host") {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-6">
          <BackButton onClick={leave} />
          <h2 className="text-2xl font-bold">Játék indítása</h2>

          {hostStep === "setup" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Melyik színnel játszol?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { v: "w", label: "Világos" },
                      { v: "b", label: "Sötét" },
                      { v: "random", label: "Véletlen" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setHostColor(opt.v)}
                      className={`rounded-md py-3 text-sm font-semibold transition ${
                        hostColor === opt.v
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-card-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={startHost}
                className="w-full rounded-md bg-primary py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
              >
                Meghívó kód létrehozása
              </button>
            </div>
          )}

          {hostStep === "offer" && (
            <div className="space-y-5">
              <ol className="space-y-1 text-sm text-muted-foreground">
                <li>1. Mutasd ezt a QR-kódot a másik telefonnak.</li>
                <li>2. Ezután olvasd be az ő válasz-kódját.</li>
              </ol>
              {peer.localCode ? (
                <div className="flex flex-col items-center gap-4">
                  <QrCode value={peer.localCode} />
                  <ManualCode code={peer.localCode} copied={copied} onCopy={copyCode} />
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">Kód készítése…</p>
              )}
              {failed && (
                <p className="rounded-md bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
                  Nem sikerült a kapcsolat. Ellenőrizd, hogy mindkét telefon ugyanazon a WiFi-n / hotspoton van, majd
                  hozz létre új meghívó kódot az „Újrakezdés" gombbal.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setScanError(null)
                  setHostStep("scan")
                }}
                className="w-full rounded-md bg-primary py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
              >
                Válaszkód beolvasása
              </button>
              {failed && (
                <button
                  type="button"
                  onClick={leave}
                  className="w-full rounded-md border border-border py-3 text-sm font-semibold text-muted-foreground transition active:scale-[0.98]"
                >
                  Újrakezdés
                </button>
              )}
            </div>
          )}

          {hostStep === "scan" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Olvasd be a másik telefon válasz QR-kódját.</p>
              <QrScanner onResult={onScanAnswer} />
              <PasteFallback onSubmit={onScanAnswer} label="Vagy illeszd be a válasz-kódot" />
              {scanError && <p className="text-center text-sm text-accent-foreground">{scanError}</p>}
              <button
                type="button"
                onClick={() => setHostStep("offer")}
                className="w-full rounded-md border border-border py-3 text-sm font-semibold text-muted-foreground"
              >
                Vissza a QR-kódhoz
              </button>
            </div>
          )}
        </div>
      </Centered>
    )
  }

  // ---- Render: join ----
  return (
    <Centered>
      <div className="w-full max-w-sm space-y-6">
        <BackButton onClick={leave} />
        <h2 className="text-2xl font-bold">Csatlakozás</h2>

        {joinStep === "scan" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Olvasd be a másik telefon meghívó QR-kódját.</p>
            <QrScanner onResult={onScanOffer} />
            <PasteFallback onSubmit={onScanOffer} label="Vagy illeszd be a meghívó-kódot" />
            {scanError && <p className="text-center text-sm text-accent-foreground">{scanError}</p>}
          </div>
        )}

        {joinStep === "answer" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Mutasd ezt a válasz-QR-t vissza a másik telefonnak. Amint beolvassa, a játék elindul.
            </p>
            {peer.localCode ? (
              <div className="flex flex-col items-center gap-4">
                <QrCode value={peer.localCode} />
                <ManualCode code={peer.localCode} copied={copied} onCopy={copyCode} />
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Válaszkód készítése…</p>
            )}
            {failed ? (
              <div className="space-y-3">
                <p className="rounded-md bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
                  Nem sikerült a kapcsolat. Ellenőrizd, hogy mindkét telefon ugyanazon a WiFi-n / hotspoton van, majd
                  próbáld újra.
                </p>
                <button
                  type="button"
                  onClick={leave}
                  className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
                >
                  Újrakezdés
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
                Kapcsolódásra várakozás…
              </div>
            )}
          </div>
        )}
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center px-5 py-8">{children}</div>
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
      ← Vissza
    </button>
  )
}

function ManualCode({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-center text-xs text-muted-foreground">
        Nem működik a QR? Szöveges kód
      </summary>
      <div className="mt-3 space-y-2">
        <textarea
          readOnly
          value={code}
          className="h-24 w-full resize-none rounded-md border border-border bg-card p-2 font-mono text-[10px] text-card-foreground"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={onCopy}
          className="w-full rounded-md bg-card py-2 text-sm font-semibold text-card-foreground"
        >
          {copied ? "Másolva!" : "Kód másolása"}
        </button>
      </div>
    </details>
  )
}

function PasteFallback({ onSubmit, label }: { onSubmit: (text: string) => void; label: string }) {
  const [value, setValue] = useState("")
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-center text-xs text-muted-foreground">{label}</summary>
      <div className="mt-3 space-y-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Illeszd be ide a kódot…"
          className="h-24 w-full resize-none rounded-md border border-border bg-card p-2 font-mono text-[10px] text-card-foreground"
        />
        <button
          type="button"
          onClick={() => value.trim() && onSubmit(value.trim())}
          className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground"
        >
          Csatlakozás a kóddal
        </button>
      </div>
    </details>
  )
}
