import { createHash } from 'crypto'

/**
 * Hash determinista SHA-256 → número en [0, 1).
 * Reprocesar la misma ronda siempre produce el mismo resultado.
 */
export function hash01(seed: string): number {
  const h = createHash('sha256').update(seed).digest()
  const v = h.readUInt32BE(0) / 0x100000000
  return v
}

/** Ruido determinista en ±rango (ej: rango=0.04 → ±4%). */
export function ruido(seed: string, rango: number): number {
  return 1 + (hash01(seed) - 0.5) * 2 * rango
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10
}
