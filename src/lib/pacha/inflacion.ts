// ============================================================
// PACHA Simulador · Módulo de inflación nacional de Bolivia (doc §18)
// π_t = clamp(π_{t-1} + Δ_esc + Σ s_k·a_k, piso, techo)
// Tasa mensual equivalente: (1+π)^(1/12) − 1
// π_c = (1−m_c)(β_c·π_t + f_c) + m_c(ΔTCO + Δp_int,c)
// Sin circularidad: π_t se fija antes de calcular costos y ventas del
// periodo; los eventos del periodo alimentan la inflación del SIGUIENTE.
// ============================================================

import { hash01 } from './hash'

export type Escenario = 'FAVORABLE' | 'ESTABLE' | 'DESFAVORABLE'

export interface LimitesInflacion {
  piso: number
  techo: number
  limiteFactores: number
  escenarios: Record<string, { probabilidad: number; deltaMin: number; deltaMax: number }>
  factoresMax: Record<string, number>
}

/** Tasa mensual equivalente (doc §18.3). */
export function tasaMensualEquivalente(pi: number): number {
  return Math.pow(1 + pi, 1 / 12) - 1
}

/**
 * Sortea el escenario del periodo con las probabilidades del panel.
 * La semilla queda registrada (doc §18.4: "la semilla del sorteo se guarda").
 */
export function sortearEscenario(semilla: string, escenarios: LimitesInflacion['escenarios']): Escenario {
  const r = hash01(semilla)
  const orden: Escenario[] = ['FAVORABLE', 'ESTABLE', 'DESFAVORABLE']
  let acum = 0
  for (const esc of orden) {
    acum += escenarios[esc]?.probabilidad ?? 0
    if (r < acum) return esc
  }
  return 'ESTABLE'
}

/** Δ_esc sorteado dentro del rango del escenario (semilla determinista). */
export function deltaEscenario(semilla: string, escenario: Escenario, escenarios: LimitesInflacion['escenarios']): number {
  const cfg = escenarios[escenario] ?? escenarios.ESTABLE
  const r = hash01(`${semilla}|delta`)
  return cfg.deltaMin + (cfg.deltaMax - cfg.deltaMin) * r
}

/**
 * Inflación del periodo (doc §18.4). Los factores s_k ya vienen en −1..+1
 * (señales); su aporte se limita por factor y en conjunto a ±limiteFactores.
 */
export function calcularInflacion(
  previa: number,
  deltaEsc: number,
  factores: { factor: string; senal: number }[],
  limites: LimitesInflacion,
  forzarTecho = false
): { pi: number; aporteEscenario: number; aporteFactores: number; factoresAplicados: { factor: string; senal: number; aporte: number }[] } {
  let suma = 0
  const factoresAplicados = factores.map(({ factor, senal }) => {
    const max = limites.factoresMax[factor] ?? 0.005
    const senalClamp = Math.max(-1, Math.min(1, senal))
    const aporte = senalClamp * max
    suma += aporte
    return { factor, senal: senalClamp, aporte }
  })
  // la suma de todos los factores se limita a ±limiteFactores por periodo
  const limite = limites.limiteFactores
  const aporteFactores = Math.max(-limite, Math.min(limite, suma))
  const aporteEscenario = deltaEsc

  let pi = previa + aporteEscenario + aporteFactores
  if (forzarTecho) pi = limites.techo // crisis económica: hasta el techo (doc §18.4)
  pi = Math.max(limites.piso, Math.min(limites.techo, pi))
  return { pi, aporteEscenario, aporteFactores, factoresAplicados }
}

/**
 * Tasa efectiva anual de un componente de costo (doc §18.7).
 * La parte importada sigue al tipo de cambio y no se multiplica además
 * por la inflación nacional (doc §18.12, regla 6).
 */
export function tasaComponente(
  importado: number,
  beta: number,
  pi: number,
  fDiferencial: number,
  deltaTCO: number,
  deltaPrecioInternacional = 0
): number {
  const m = Math.max(0, Math.min(1, importado))
  return (1 - m) * (beta * pi + fDiferencial) + m * (deltaTCO + deltaPrecioInternacional)
}

/**
 * Poder adquisitivo real (doc §18.8): PA_real = (1+g)/(1+π) − 1.
 * Cae solo cuando la inflación supera el crecimiento nominal del ingreso.
 */
export function poderAdquisitivoReal(g: number, pi: number): number {
  return (1 + g) / (1 + pi) - 1
}

/**
 * Prueba de neutralidad (doc §18.12, regla 12): si precios y costos suben
 * exactamente π_t, el margen porcentual no cambia.
 */
export function margenNeutral(pi: number, precio0: number, costo0: number): boolean {
  const precio1 = precio0 * (1 + pi)
  const costo1 = costo0 * (1 + pi)
  const margen0 = (precio0 - costo0) / precio0
  const margen1 = (precio1 - costo1) / precio1
  return Math.abs(margen0 - margen1) < 1e-9
}

/** Índice de precios encadenado (base 100 en el Año 0). */
export function indicePrecios(indiceAnterior: number, pi: number): number {
  return indiceAnterior * (1 + pi)
}

/** Evolución mensual de un componente: 12 tasas mensuales cuyo acumulado anual equivale a π_c. */
export function tasasMensualesComponente(piC: number): number[] {
  const mensual = tasaMensualEquivalente(Math.max(-0.99, piC))
  return Array(12).fill(mensual)
}
