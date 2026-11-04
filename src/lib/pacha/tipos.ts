// Tipos compartidos del dominio PACHA

export interface DecisionMarca {
  marcaId: string
  precio: number
  publicidad: number
  produccion: number
  vendedores: number[] // [tiendas, supermercados, kioscos]
}

export interface DecisionNueva {
  nombre: string
  proyectoId: string
  precio: number
  publicidad: number
  produccion: number
  vendedores: number[]
}

export interface DecisionContenido {
  marcas: DecisionMarca[]
  nuevas: DecisionNueva[]
  estudios: number[]
  inversionCapacidad?: number // miles de litros (doc §5)
}

export function parseDecision(json: string | null | undefined): DecisionContenido {
  if (!json) return { marcas: [], nuevas: [], estudios: [] }
  try {
    const v = JSON.parse(json) as Partial<DecisionContenido>
    return {
      marcas: Array.isArray(v.marcas) ? v.marcas : [],
      nuevas: Array.isArray(v.nuevas) ? v.nuevas : [],
      estudios: Array.isArray(v.estudios) ? v.estudios : [],
      inversionCapacidad: typeof v.inversionCapacidad === 'number' ? v.inversionCapacidad : undefined,
    }
  } catch {
    return { marcas: [], nuevas: [], estudios: [] }
  }
}

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export class PachaError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}
