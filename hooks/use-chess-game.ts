"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Chess, type Square } from "chess.js"

export type Move = { from: Square; to: Square; promotion?: string }

export type GameStatus = {
  turn: "w" | "b"
  inCheck: boolean
  isCheckmate: boolean
  isDraw: boolean
  isGameOver: boolean
  winner: "w" | "b" | null
}

function statusOf(game: Chess): GameStatus {
  const isCheckmate = game.isCheckmate()
  const isGameOver = game.isGameOver()
  const turn = game.turn()
  return {
    turn,
    inCheck: game.inCheck(),
    isCheckmate,
    isDraw: game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial(),
    isGameOver,
    winner: isCheckmate ? (turn === "w" ? "b" : "w") : null,
  }
}

export function useChessGame() {
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [history, setHistory] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)

  const status = useMemo(() => statusOf(gameRef.current), [fen])

  const sync = useCallback(() => {
    setFen(gameRef.current.fen())
    setHistory(gameRef.current.history())
  }, [])

  // Attempt a move locally. Returns the normalized move if legal, else null.
  const tryMove = useCallback(
    (from: Square, to: Square, promotion = "q"): Move | null => {
      try {
        const result = gameRef.current.move({ from, to, promotion })
        if (!result) return null
        setLastMove({ from: result.from as Square, to: result.to as Square })
        sync()
        return { from: result.from as Square, to: result.to as Square, promotion: result.promotion }
      } catch {
        return null
      }
    },
    [sync],
  )

  // Apply a move received from the peer.
  const applyRemoteMove = useCallback(
    (move: Move): boolean => {
      try {
        const result = gameRef.current.move({ from: move.from, to: move.to, promotion: move.promotion || "q" })
        if (!result) return false
        setLastMove({ from: result.from as Square, to: result.to as Square })
        sync()
        return true
      } catch {
        return false
      }
    },
    [sync],
  )

  const legalMovesFrom = useCallback((square: Square): Square[] => {
    try {
      return gameRef.current.moves({ square, verbose: true }).map((m) => m.to as Square)
    } catch {
      return []
    }
  }, [])

  const pieceOn = useCallback((square: Square) => gameRef.current.get(square), [fen])

  const reset = useCallback(() => {
    gameRef.current = new Chess()
    setLastMove(null)
    sync()
  }, [sync])

  const loadFen = useCallback(
    (nextFen: string) => {
      try {
        gameRef.current.load(nextFen)
        setLastMove(null)
        sync()
      } catch {
        /* ignore */
      }
    },
    [sync],
  )

  return {
    fen,
    history,
    lastMove,
    status,
    tryMove,
    applyRemoteMove,
    legalMovesFrom,
    pieceOn,
    reset,
    loadFen,
  }
}
