"use client"

import { useMemo } from "react"
import type { Square } from "chess.js"

const GLYPH: Record<string, string> = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

type PieceInfo = { type: string; color: "w" | "b" }

// Parse a FEN placement field into a square -> piece map.
function parseFen(fen: string): Record<string, PieceInfo> {
  const map: Record<string, PieceInfo> = {}
  const placement = fen.split(" ")[0]
  const rows = placement.split("/")
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r
    let file = 0
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        file += Number.parseInt(ch, 10)
      } else {
        const square = `${FILES[file]}${rank}`
        map[square] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" }
        file += 1
      }
    }
  }
  return map
}

export function ChessBoard({
  fen,
  orientation,
  selected,
  legalTargets,
  lastMove,
  interactive,
  onSquareClick,
}: {
  fen: string
  orientation: "w" | "b"
  selected: Square | null
  legalTargets: Square[]
  lastMove: { from: Square; to: Square } | null
  interactive: boolean
  onSquareClick: (square: Square) => void
}) {
  const pieces = useMemo(() => parseFen(fen), [fen])

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === "w" ? FILES : [...FILES].reverse()

  return (
    <div
      className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md border border-border shadow-lg"
      role="grid"
      aria-label="Sakktábla"
    >
      {ranks.map((rank, ri) =>
        files.map((file, fi) => {
          const square = `${file}${rank}` as Square
          const isDark = (ri + fi) % 2 === 1
          const piece = pieces[square]
          const isSelected = selected === square
          const isTarget = legalTargets.includes(square)
          const isLast = lastMove && (lastMove.from === square || lastMove.to === square)
          const isCapture = isTarget && !!piece

          return (
            <button
              key={square}
              type="button"
              disabled={!interactive}
              onClick={() => onSquareClick(square)}
              className="relative flex items-center justify-center"
              style={{ background: isDark ? "var(--board-dark)" : "var(--board-light)" }}
              aria-label={square + (piece ? ` ${piece.color === "w" ? "világos" : "sötét"}` : "")}
            >
              {isLast && <span className="pointer-events-none absolute inset-0 bg-primary/25" aria-hidden />}
              {isSelected && (
                <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary" aria-hidden />
              )}

              {piece && (
                <span
                  className="relative z-10 leading-none"
                  style={{
                    fontSize: "min(9vw, 2.6rem)",
                    color: piece.color === "w" ? "oklch(0.98 0.01 90)" : "oklch(0.16 0.01 60)",
                    textShadow:
                      piece.color === "w"
                        ? "0 1px 1px rgba(0,0,0,0.55)"
                        : "0 1px 1px rgba(255,255,255,0.25)",
                  }}
                >
                  {GLYPH[piece.type]}
                </span>
              )}

              {isTarget && !isCapture && (
                <span
                  className="pointer-events-none absolute z-0 h-[28%] w-[28%] rounded-full bg-primary/60"
                  aria-hidden
                />
              )}
              {isCapture && (
                <span
                  className="pointer-events-none absolute inset-[8%] z-0 rounded-full ring-[3px] ring-primary/70"
                  aria-hidden
                />
              )}

              {/* File / rank coordinate labels along the edges */}
              {fi === 0 && (
                <span
                  className="pointer-events-none absolute left-0.5 top-0.5 text-[9px] font-medium opacity-60"
                  style={{ color: isDark ? "var(--board-light)" : "var(--board-dark)" }}
                  aria-hidden
                >
                  {rank}
                </span>
              )}
              {ri === 7 && (
                <span
                  className="pointer-events-none absolute bottom-0.5 right-0.5 text-[9px] font-medium opacity-60"
                  style={{ color: isDark ? "var(--board-light)" : "var(--board-dark)" }}
                  aria-hidden
                >
                  {file}
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
