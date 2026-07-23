"use client"

import { useState } from "react"
import type { Square } from "chess.js"
import { ChessBoard } from "@/components/chess-board"
import type { GameStatus } from "@/hooks/use-chess-game"

export function GameView({
  fen,
  myColor,
  status,
  lastMove,
  connected,
  resignedBy,
  legalMovesFrom,
  onMove,
  onNewGame,
  onResign,
  onLeave,
}: {
  fen: string
  myColor: "w" | "b"
  status: GameStatus
  lastMove: { from: Square; to: Square } | null
  connected: boolean
  resignedBy: "me" | "them" | null
  legalMovesFrom: (sq: Square) => Square[]
  onMove: (from: Square, to: Square) => void
  onNewGame: () => void
  onResign: () => void
  onLeave: () => void
}) {
  const [selected, setSelected] = useState<Square | null>(null)
  const [targets, setTargets] = useState<Square[]>([])

  const myTurn = connected && !status.isGameOver && !resignedBy && status.turn === myColor

  function handleSquare(square: Square) {
    if (!myTurn) return
    if (selected) {
      if (square === selected) {
        setSelected(null)
        setTargets([])
        return
      }
      if (targets.includes(square)) {
        onMove(selected, square)
        setSelected(null)
        setTargets([])
        return
      }
    }
    // Select a new square if it has a legal move
    const moves = legalMovesFrom(square)
    if (moves.length > 0) {
      setSelected(square)
      setTargets(moves)
    } else {
      setSelected(null)
      setTargets([])
    }
  }

  const banner = (() => {
    if (resignedBy === "them") return { text: "Az ellenfél feladta. Nyertél!", tone: "win" as const }
    if (resignedBy === "me") return { text: "Feladtad a játszmát.", tone: "lose" as const }
    if (status.isCheckmate)
      return {
        text: status.winner === myColor ? "Matt — nyertél!" : "Matt — vesztettél.",
        tone: status.winner === myColor ? ("win" as const) : ("lose" as const),
      }
    if (status.isDraw) return { text: "Döntetlen.", tone: "info" as const }
    if (!connected) return { text: "A kapcsolat megszakadt.", tone: "lose" as const }
    if (status.inCheck)
      return {
        text: status.turn === myColor ? "Sakkban vagy!" : "Sakkot adtál.",
        tone: "info" as const,
      }
    return {
      text: myTurn ? "Te lépsz" : "Ellenfél lép…",
      tone: "info" as const,
    }
  })()

  const toneClass =
    banner.tone === "win"
      ? "bg-primary text-primary-foreground"
      : banner.tone === "lose"
        ? "bg-accent text-accent-foreground"
        : "bg-card text-card-foreground"

  return (
    <div className="flex min-h-dvh flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: connected ? "var(--primary)" : "var(--accent)" }}
            aria-hidden
          />
          <span className="text-sm text-muted-foreground">
            {connected ? "Csatlakozva" : "Nincs kapcsolat"}
          </span>
        </div>
        <span className="text-sm font-medium">
          Te: {myColor === "w" ? "Világos" : "Sötét"}
        </span>
      </header>

      <div className={`rounded-md px-4 py-3 text-center text-sm font-semibold ${toneClass}`} role="status">
        {banner.text}
      </div>

      <div className="mx-auto w-full max-w-[440px]">
        <ChessBoard
          fen={fen}
          orientation={myColor}
          selected={selected}
          legalTargets={targets}
          lastMove={lastMove}
          interactive={myTurn}
          onSquareClick={handleSquare}
        />
      </div>

      <div className="mx-auto grid w-full max-w-[440px] grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onNewGame}
          className="rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"
        >
          Új játszma
        </button>
        <button
          type="button"
          onClick={onResign}
          disabled={status.isGameOver || !!resignedBy}
          className="rounded-md bg-card py-3 text-sm font-semibold text-card-foreground transition active:scale-95 disabled:opacity-40"
        >
          Feladom
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-border py-3 text-sm font-semibold text-muted-foreground transition active:scale-95"
        >
          Kilépés
        </button>
      </div>
    </div>
  )
}
