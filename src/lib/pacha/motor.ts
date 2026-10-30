// ============================================================
// PACHA Simulador · Motor de simulación (determinista)
// Mercado: unidades físicas · Producción/ventas/inventario: miles de unidades
// Precio: Bs/unidad · Dinero (publicidad, ingresos, costos, contribución): miles Bs
// ============================================================

import { CANALES, SEGMENTOS, demandaAnio, type Segmento } from './catalogo'
import { clamp, hash01, round1, round2, ruido } from './hash'

export interface MarcaSim {
  marcaId: string
  equipoId: string
  nombre: string
  precio: number
  publicidad: number
  produccion: number
  costoUnitario: number
  atributos: number[]
  vendedores: number[] // [tiendas, supermercados, kioscos]
  inventario: number
  awareness: number
}

export interface ResultadoMarca {
  marcaId: string
  equipoId: string
  nombre: string
  ventas: number
  produccion: number
  inventarioFinal: number
  ingresos: number
  costos: number
  publicidad: number
  fuerzaVentas: number
  contribucion: number
  porSegmento: { segmentoId: string; ventas: number; ingresos: number }[]
  porCanal: { canalId: string; ventas: number; ingresos: number }[]
  sinStock: boolean
  awarenessNueva: number
}

export interface ResultadoEquipo {
  equipoId: string
  ventas: number
  ingresos: number
  costos: number
  publicidad: number
  fuerzaVentas: number
  contribucion: number
  participacion: number // % sobre ventas totales del mercado
}

export interface ResultadoMercado {
  anio: number
  marcas: ResultadoMarca[]
  equipos: ResultadoEquipo[]
  demandaTotal: number
  ventasTotales: number
}

/** Ajuste producto↔segmento: 1 = encaja perfecto con el ideal. */
export function ajusteProducto(atributos: number[], ideal: number[]): number {
  let dist = 0
  for (let i = 0; i < 6; i++) dist += Math.abs(atributos[i] - ideal[i])
  return 1 - dist / (6 * 9) // distancia máxima 9 por atributo
}

/** Cobertura de un canal según vendedores destinados (base 15% sin vendedores). */
export function coberturaCanal(vendedores: number, canalIdx: number): number {
  const necesarios = CANALES[canalIdx].vendedoresNecesarios
  return clamp(0.15 + 0.85 * Math.min(1, vendedores / necesarios), 0.15, 1)
}

/** Atractivo de una marca en un segmento (0..1). */
export function atractivo(marca: MarcaSim, seg: Segmento, anio: number): number {
  // Precio relativo
  const precioRel = marca.precio / seg.precioIdeal
  const scorePrecio = precioRel <= 1 ? 1 : Math.exp(-seg.sensibilidadPrecio * (precioRel - 1))
  // Awareness (0..1)
  const scoreAwareness = clamp(marca.awareness, 0.01, 1)
  // Cobertura de canales (ponderada por el peso de demanda del canal)
  let scoreCanales = 0
  for (let c = 0; c < 3; c++) {
    scoreCanales += CANALES[c].pesoDemanda * coberturaCanal(marca.vendedores[c] ?? 0, c)
  }
  // Ajuste producto
  const scoreAjuste = ajusteProducto(marca.atributos, seg.ideal)
  // Media geométrica ponderada
  const base =
    Math.pow(clamp(scorePrecio, 0.01, 1), seg.pesoPrecio) *
    Math.pow(scoreAwareness, seg.pesoAwareness) *
    Math.pow(clamp(scoreCanales, 0.01, 1), seg.pesoCanales) *
    Math.pow(clamp(scoreAjuste, 0.01, 1), seg.pesoAjuste)
  // Ruido determinista ±4%
  return clamp(base * ruido(`${marca.marcaId}|${seg.id}|${anio}`, 0.04), 0.001, 1)
}

/** Costo de fuerza de ventas: Σ vendedores × salario del canal. */
export function costoFuerzaVentas(vendedores: number[]): number {
  return vendedores.reduce((s, v, i) => s + v * CANALES[i].salario, 0)
}

/**
 * Ejecuta la simulación de un año para todas las marcas activas de la industria.
 * Reparte la demanda de cada segmento proporcionalmente al atractivo, aplica
 * límites de producción + inventario (merma 5%) y calcula resultados financieros.
 */
export function simularAnio(anio: number, marcas: MarcaSim[]): ResultadoMercado {
  const activas = marcas.filter((m) => m.precio > 0)
  const porMarca = new Map<string, { segVentas: Map<string, number>; atractivos: Map<string, number> }>()

  // 1) Demanda por segmento y reparto según atractivo
  for (const seg of SEGMENTOS) {
    const demanda = demandaAnio(anio, seg) * ruido(`demanda-mercado|${seg.id}|${anio}`, 0.03)
    const atractivos = activas.map((m) => ({ m, a: atractivo(m, seg, anio) }))
    const suma = atractivos.reduce((s, x) => s + x.a, 0)
    for (const { m, a } of atractivos) {
      let entry = porMarca.get(m.marcaId)
      if (!entry) {
        entry = { segVentas: new Map(), atractivos: new Map() }
        porMarca.set(m.marcaId, entry)
      }
      entry.atractivos.set(seg.id, a)
      const vendidas = suma > 0 ? (demanda * a) / suma : 0
      entry.segVentas.set(seg.id, vendidas)
    }
  }

  // 2) Límite por oferta (producción + inventario con merma 5%) y finanzas
  const resultados: ResultadoMarca[] = []
  for (const m of activas) {
    const entry = porMarca.get(m.marcaId)!
    const demandaTotal = [...entry.segVentas.values()].reduce((s, v) => s + v, 0)
    const disponible = m.produccion + m.inventario * 0.95
    const ventas = Math.min(demandaTotal, disponible)
    const factor = demandaTotal > 0 ? ventas / demandaTotal : 0

    const porSegmento: { segmentoId: string; ventas: number; ingresos: number }[] = []
    for (const seg of SEGMENTOS) {
      const v = round1((entry.segVentas.get(seg.id) ?? 0) * factor)
      porSegmento.push({ segmentoId: seg.id, ventas: v, ingresos: round1(v * m.precio) })
    }

    // Reparto de ventas entre canales según cobertura ponderada
    const pesosCanal = CANALES.map((c, i) => c.pesoDemanda * coberturaCanal(m.vendedores[i] ?? 0, i))
    const sumaCanales = pesosCanal.reduce((s, p) => s + p, 0) || 1
    const porCanal = CANALES.map((c, i) => {
      const v = round1(ventas * (pesosCanal[i] / sumaCanales))
      return { canalId: c.id, ventas: v, ingresos: round1(v * m.precio) }
    })

    const inventarioFinal = Math.max(0, disponible - ventas)
    const ingresos = round1(ventas * m.precio)
    const costoProductos = round1(ventas * m.costoUnitario)
    const costoInventario = round1(inventarioFinal * m.costoUnitario * 0.01)
    const costos = round2(costoProductos + costoInventario)
    const fuerzaVentas = round1(costoFuerzaVentas(m.vendedores))
    const contribucion = round1(ingresos - costos - m.publicidad - fuerzaVentas)

    // Actualización de awareness para el año siguiente
    const awarenessNueva = clamp(0.65 * m.awareness + 0.45 * Math.sqrt(Math.max(0, m.publicidad) / 300), 0.02, 0.95)

    resultados.push({
      marcaId: m.marcaId,
      equipoId: m.equipoId,
      nombre: m.nombre,
      ventas: round1(ventas),
      produccion: round1(m.produccion),
      inventarioFinal: round1(inventarioFinal),
      ingresos,
      costos,
      publicidad: round1(m.publicidad),
      fuerzaVentas,
      contribucion,
      porSegmento,
      porCanal,
      sinStock: demandaTotal > disponible * 1.01,
      awarenessNueva: round2(awarenessNueva),
    })
  }

  // 3) Agregados por equipo y participación de mercado
  const ventasTotales = resultados.reduce((s, r) => s + r.ventas, 0)
  const demandaTotal = SEGMENTOS.reduce((s, seg) => s + demandaAnio(anio, seg), 0)
  const equipoIds = [...new Set(activas.map((m) => m.equipoId))]
  const equipos: ResultadoEquipo[] = equipoIds.map((equipoId) => {
    const rs = resultados.filter((r) => r.equipoId === equipoId)
    const ventas = round1(rs.reduce((s, r) => s + r.ventas, 0))
    const ingresos = round1(rs.reduce((s, r) => s + r.ingresos, 0))
    const costos = round1(rs.reduce((s, r) => s + r.costos, 0))
    const publicidad = round1(rs.reduce((s, r) => s + r.publicidad, 0))
    const fuerzaVentas = round1(rs.reduce((s, r) => s + r.fuerzaVentas, 0))
    return {
      equipoId,
      ventas,
      ingresos,
      costos,
      publicidad,
      fuerzaVentas,
      contribucion: round1(rs.reduce((s, r) => s + r.contribucion, 0)),
      participacion: ventasTotales > 0 ? round2((ventas / ventasTotales) * 100) : 0,
    }
  })

  return { anio, marcas: resultados, equipos, demandaTotal: round1(demandaTotal), ventasTotales: round1(ventasTotales) }
}

// ===================== AÑO 0 · Diagnóstico inicial =====================

export interface MarcaAnio0 {
  marcaId: string
  equipoId: string
  nombre: string
  precio: number
  publicidad: number
  costoUnitario: number
  vendedores: number[]
}

/**
 * El Año 0 no es una ronda del motor: es el diagnóstico inicial de cada firma.
 * Participaciones iniciales normalizadas a 100%, producción = ventas, inventario 0,
 * costo de transferencia = 55% del precio (o basado en atributo 6).
 */
export function reportesAnio0(marcas: MarcaAnio0[]): { marcas: ResultadoMarca[]; equipos: ResultadoEquipo[] } {
  const porEquipo = new Map<string, MarcaAnio0[]>()
  for (const m of marcas) {
    const arr = porEquipo.get(m.equipoId) ?? []
    arr.push(m)
    porEquipo.set(m.equipoId, arr)
  }

  const demandaTotal0 = SEGMENTOS.reduce((s, seg) => s + seg.demandaBase, 0) * 0.95
  const pesoBase = 1 / Math.max(1, porEquipo.size)

  const resultados: ResultadoMarca[] = []
  for (const [equipoId, ms] of porEquipo) {
    // Participación inicial determinista del equipo (±15% alrededor del reparto parejo)
    const factorEquipo = ruido(`anio0|${equipoId}`, 0.15)
    const participacionEquipo = clamp(pesoBase * factorEquipo, 0.05, 0.6)
    const ventasEquipo = demandaTotal0 * participacionEquipo

    for (const m of ms) {
      const ventas = round1(ventasEquipo / ms.length)
      const ingresos = round1(ventas * m.precio)
      const costos = round1(ingresos * 0.55) // costo de transferencia
      const fuerzaVentas = round1(costoFuerzaVentas(m.vendedores))
      const contribucion = round1(ingresos - costos - m.publicidad - fuerzaVentas)
      const pesosCanal = CANALES.map((c, i) => c.pesoDemanda * coberturaCanal(m.vendedores[i] ?? 0, i))
      const sumaC = pesosCanal.reduce((s, p) => s + p, 0) || 1
      resultados.push({
        marcaId: m.marcaId,
        equipoId,
        nombre: m.nombre,
        ventas,
        produccion: ventas,
        inventarioFinal: 0,
        ingresos,
        costos,
        publicidad: round1(m.publicidad),
        fuerzaVentas,
        contribucion,
        porSegmento: SEGMENTOS.map((seg) => ({
          segmentoId: seg.id,
          ventas: round1(ventas * (seg.demandaBase / demandaTotal0)),
          ingresos: round1(ventas * (seg.demandaBase / demandaTotal0) * m.precio),
        })),
        porCanal: CANALES.map((c, i) => {
          const v = round1(ventas * (pesosCanal[i] / sumaC))
          return { canalId: c.id, ventas: v, ingresos: round1(v * m.precio) }
        }),
        sinStock: false,
        awarenessNueva: round2(clamp(0.05 + 0.1 * Math.sqrt(m.publicidad / 300), 0.05, 0.4)),
      })
    }
  }

  const ventasTotales = resultados.reduce((s, r) => s + r.ventas, 0)
  const equipos: ResultadoEquipo[] = [...porEquipo.keys()].map((equipoId) => {
    const rs = resultados.filter((r) => r.equipoId === equipoId)
    const ventas = round1(rs.reduce((s, r) => s + r.ventas, 0))
    const ingresos = round1(rs.reduce((s, r) => s + r.ingresos, 0))
    const costos = round1(rs.reduce((s, r) => s + r.costos, 0))
    const publicidad = round1(rs.reduce((s, r) => s + r.publicidad, 0))
    const fuerzaVentas = round1(rs.reduce((s, r) => s + r.fuerzaVentas, 0))
    return {
      equipoId,
      ventas,
      ingresos,
      costos,
      publicidad,
      fuerzaVentas,
      contribucion: round1(rs.reduce((s, r) => s + r.contribucion, 0)),
      participacion: round2((ventas / ventasTotales) * 100),
    }
  })

  return { marcas: resultados, equipos }
}
