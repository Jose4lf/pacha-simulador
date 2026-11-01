// ============================================================
// PACHA Simulador · Motor de simulación BOLIVIA (determinista)
// Cada periodo = 1 año calculado en 12 pasos mensuales (doc §13):
// demanda regional y por segmento con estacionalidad, eventos que
// modifican los cálculos, Resto del mercado, producción e inventarios,
// costos indexados por inflación y tipo de cambio (doc §18.7), impuestos
// (IVA/IT/IUE) y finanzas. Volumen: miles de litros · Dinero: miles Bs.
// ============================================================

import type { ConfigIndustria } from './config-bolivia'
import type { EfectosAgrupados } from './eventos'
import { clamp, ruido, round1, round2 } from './hash'

export interface MarcaSim {
  marcaId: string
  equipoId: string
  nombre: string
  precio: number // Bs por litro (con IVA incluido)
  publicidad: number // miles Bs
  produccion: number // miles de litros/año decididos
  costoUnitario: number // Bs por litro (año base; se indexa en el motor)
  atributos: number[] // [variedad sabores, cremosidad, grasa, presentación, calidad envase, calidad ingredientes] 1..10
  vendedores: number[] // fuerza de ventas por canal [tradicional, supermercados, horeca]
  inventario: number // miles de litros al inicio del año
  awareness: number // 0..1
}

export interface ContextoMacro {
  piAnual: number // inflación del periodo π_t (fijada antes de calcular, doc §18.12)
  tasaMensual: number // (1+π)^(1/12) − 1
  indicePreciosInicio: number // base 100 en el Año 0
  tipoCambioInicio: number
  tipoCambioFinal: number
  tasaInteres: number
  tasasComponentes: Record<string, number> // π_c anual por componente (doc §18.7)
}

export interface ContextoAnio {
  config: ConfigIndustria
  eventos: EfectosAgrupados
  macro: ContextoMacro
  capacidad: Record<string, { instalada: number; maxima: number }> // por equipoId
  inversionCapacidad: Record<string, number> // miles de litros solicitados por equipo
  deuda: Record<string, number> // deuda inicial por equipo (miles Bs)
}

export interface ResultadoMarca {
  marcaId: string
  equipoId: string
  nombre: string
  ventas: number
  produccion: number
  inventarioFinal: number
  ingresos: number // netos de IVA
  costos: number
  publicidad: number
  fuerzaVentas: number
  contribucion: number
  porSegmento: { segmentoId: string; ventas: number; ingresos: number }[]
  porCanal: { canalId: string; ventas: number; ingresos: number }[]
  sinStock: boolean
  awarenessNueva: number
  ventasMensual: number[] // miles de litros por mes
  precioReal: number // Bs por litro al índice de precios del año
}

export interface FinanzasEquipo {
  ingresosBrutos: number
  ingresosNetos: number
  iva: number
  costoProductos: number
  almacenamiento: number
  logistica: number
  perdidasCadenaFrio: number
  promocion: number
  investigacionMercado: number
  comisionVendedores: number
  publicidad: number
  fuerzaVentas: number
  costoCapacidad: number
  utilidadOperativa: number
  margenBruto: number
  margenOperativo: number
  intereses: number
  it: number
  iue: number
  utilidadNeta: number
  deudaFinal: number
  endeudamientoAviso: boolean
  roi: number
}

export interface ResultadoEquipo {
  equipoId: string
  ventas: number // miles de litros
  ingresos: number // miles Bs netos
  costos: number
  publicidad: number
  fuerzaVentas: number
  contribucion: number
  participacion: number // % sobre el mercado de las empresas jugables
  participacionTotal: number // % sobre el mercado TOTAL (incluye Resto)
  porRegion: { regionId: string; ventas: number }[]
  finanzas: FinanzasEquipo
  produccionAnio: { capacidadInstalada: number; capacidadUtilizada: number; utilizacionPct: number; merma: number; inversionCapacidad: number; inventarioFinal: number; quiebresStock: number }
}

export interface ResultadoMercado {
  anio: number
  marcas: ResultadoMarca[]
  equipos: ResultadoEquipo[]
  demandaTotal: number
  ventasTotales: number
  ventasEmpresas: number
  ventasResto: number
  capturaEmpresas: number // % del mercado total atendido por las empresas jugables
  detalleMensual: { mes: number; demandaTotal: number; ventasEmpresas: number; ventasResto: number }[]
  eventosTrazabilidad: EfectosAgrupados['trazabilidad']
  macroResumen: { piAnual: number; indicePreciosFin: number; tipoCambioFinal: number; tasasComponentes: Record<string, number> }
}

/** Ajuste producto↔segmento: 1 = encaja perfecto con el ideal. */
export function ajusteProducto(atributos: number[], ideal: number[]): number {
  let dist = 0
  for (let i = 0; i < 6; i++) dist += Math.abs(atributos[i] - ideal[i])
  return 1 - dist / (6 * 9)
}

/** Cobertura de un canal según fuerza de ventas destinada (base 15% sin vendedores). */
export function coberturaCanal(vendedores: number, canalIdx: number, necesarios: number[] = [750, 75, 105]): number {
  const nec = necesarios[canalIdx] ?? 100
  return clamp(0.15 + 0.85 * Math.min(1, vendedores / nec), 0.15, 1)
}

/** Atractivo de una marca para un segmento (0..1), con precio REAL (doc §18.8). */
export function atractivo(
  marca: { nombre: string; precio: number; publicidad: number; atributos: number[]; vendedores: number[]; awareness: number },
  seg: { precioIdeal: number; sensibilidadPrecio: number; pesoPrecio: number; pesoAwareness: number; pesoCanales: number; pesoAjuste: number; ideal: number[] },
  anio: number,
  indicePrecios = 100,
  necesariosCanal = [750, 75, 105]
): number {
  // Precio real: la demanda reacciona al precio deflactado por el índice de precios
  const precioReal = (100 * marca.precio) / indicePrecios
  const precioRel = precioReal / seg.precioIdeal
  const scorePrecio = precioRel <= 1 ? 1 : Math.exp(-seg.sensibilidadPrecio * 0.35 * (precioRel - 1))
  const scoreAwareness = clamp(marca.awareness, 0.01, 1)
  let scoreCanales = 0
  for (let c = 0; c < 3; c++) scoreCanales += (0.45 + c * -0.05 + (c === 2 ? 0.05 : 0)) * coberturaCanal(marca.vendedores[c] ?? 0, c, necesariosCanal)
  scoreCanales = clamp(scoreCanales / 0.9, 0, 1)
  const scoreAjuste = ajusteProducto(marca.atributos, seg.ideal)
  const base =
    Math.pow(clamp(scorePrecio, 0.01, 1), seg.pesoPrecio) *
    Math.pow(scoreAwareness, seg.pesoAwareness) *
    Math.pow(clamp(scoreCanales, 0.01, 1), seg.pesoCanales) *
    Math.pow(clamp(scoreAjuste, 0.01, 1), seg.pesoAjuste)
  return clamp(base * ruido(`${marca.nombre}|${seg.precioIdeal}|${anio}`, 0.04), 0.001, 1)
}

/** Costo de fuerza de ventas: Σ vendedores × salario del canal (miles Bs/año). */
export function costoFuerzaVentas(vendedores: number[], salarios = [4.5, 5.5, 6]): number {
  return vendedores.reduce((s, v, i) => s + v * (salarios[i] ?? 5), 0)
}

/** Costo de fabricación por litro según calidad de atributos (doc §4: Bs 8..45). */
export function costoLitroDesdeAtributos(insumosBase: number, atributos: number[], inflacionAcumulada: number): number {
  const prom = atributos.reduce((s, a) => s + a, 0) / atributos.length
  const conversion = 4 + 1.7 * prom // margen de conversión Bs/L en el Año 0 (hipótesis)
  return round2((insumosBase + conversion) * inflacionAcumulada)
}

/** Cobertura regional de una empresa (1..10) derivada de su fuerza de ventas (doc §8). */
export function coberturaRegional(vendedoresTotal: number, factorLogistico: number): number {
  const necesarios = 930 // Σ unidades de cobertura simuladas de los 3 canales
  const base = 1 + 9 * Math.min(1, vendedoresTotal / necesarios)
  return clamp(base / factorLogistico, 1, 10)
}

// ============================================================
// MOTOR MENSUAL (doc §13, §15): 12 pasos mensuales por periodo
// ============================================================

export function simularAnioBolivia(anio: number, marcas: MarcaSim[], ctx: ContextoAnio): ResultadoMercado {
  const { config, eventos, macro } = ctx
  const activas = marcas.filter((m) => m.precio > 0)
  const meses = Array.from({ length: 12 }, (_, i) => i + 1)

  // ----- Costos de insumos: encadenado anual de los componentes con π_c (doc §18.7)
  const insumosBase0 = config.costos.reduce((s, c) => s + c.peso * c.precioBase, 0)
  const inflacionCostos = config.costos.reduce((s, c) => s + c.peso * (1 + (macro.tasasComponentes[c.id] ?? 0)), 0)

  // ----- Demanda del año por segmento (crecimiento 4% en volumen + poder adquisitivo real, doc §18.8)
  const paReal = (1 + config.macro.crecimientoNominalIngreso) / (1 + macro.piAnual) - 1
  const demandaSegmentos: Record<string, number> = {}
  let demandaAnioTotal = 0
  for (const seg of config.segmentos) {
    const crecimiento = clamp(config.macro.crecimientoBase + seg.elasticidadIngreso * paReal, -0.2, 0.25)
    const base = config.mercadoTotalAnio0 * seg.peso * Math.pow(1 + crecimiento, anio)
    demandaSegmentos[seg.id] = base
    demandaAnioTotal += base
  }

  // ----- Índice de precios del año: los precios nominales se deflactan (doc §18.8)
  const indiceFin = macro.indicePreciosInicio * (1 + macro.piAnual)

  // ----- Capacidad e inversión (doc §5): producción limitada por capacidad instalada
  const capacidadEquipo: Record<string, number> = {}
  for (const [equipoId, cap] of Object.entries(ctx.capacidad)) {
    const inversion = clamp(ctx.inversionCapacidad[equipoId] ?? 0, 0, Math.max(0, cap.maxima - cap.instalada))
    capacidadEquipo[equipoId] = cap.instalada + inversion
  }
  const produccionPorEquipo: Record<string, number> = {}
  const produccionDisponible: Record<string, number> = {}
  for (const m of activas) {
    const cap = capacidadEquipo[m.equipoId] ?? 1000
    const acumulado = produccionPorEquipo[m.equipoId] ?? 0
    const permitido = Math.max(0, cap - acumulado)
    const produccion = clamp(m.produccion, 0, permitido)
    produccionDisponible[m.marcaId] = produccion
    produccionPorEquipo[m.equipoId] = acumulado + produccion
  }

  // ----- Atractivo por marca y segmento con precio REAL (doc §18.8)
  const necesariosCanal = config.canales.map((c) => Math.max(5, Math.round(c.unidadesCobertura / 10)))
  const atractivos: Record<string, Record<string, number>> = {}
  for (const m of activas) {
    atractivos[m.marcaId] = {}
    for (const seg of config.segmentos) {
      atractivos[m.marcaId][seg.id] = atractivo(m, seg, anio, indiceFin, necesariosCanal)
    }
  }

  // ----- Resto del mercado (doc §1.2): no decide, pero gana o cede participación
  // según el marketing, la distribución y la calidad relativa de las empresas,
  // y responde al precio promedio del mercado y a la inflación.
  const precioIdealPromedio = config.segmentos.reduce((s, x) => s + x.precioIdeal * x.peso, 0)
  const ingresosRef = config.mercadoTotalAnio0 * (1 - config.pesoRestoMercado) * precioIdealPromedio
  const nEmpresas = Math.max(1, new Set(activas.map((m) => m.equipoId)).size)
  const publicidadRefEmpresa = 0.04 * ingresosRef / nEmpresas
  const publicidadProm = activas.reduce((s, m) => s + m.publicidad, 0) / Math.max(1, activas.length)
  const coberturaProm = activas.reduce((s, m) => s + m.vendedores.reduce((a, b) => a + b, 0), 0) / Math.max(1, activas.length)
  const calidadProm = activas.reduce((s, m) => s + m.atributos.reduce((a, b) => a + b, 0) / 6, 0) / Math.max(1, activas.length)
  const precioRealPromedio = activas.reduce((s, m) => s + (100 * m.precio) / indiceFin, 0) / Math.max(1, activas.length)
  const publicidadRel = clamp(publicidadProm / Math.max(1, publicidadRefEmpresa), 0.4, 2)
  const coberturaRel = clamp(coberturaProm / 100, 0.4, 2)
  const calidadRel = clamp(calidadProm / 5.5, 0.4, 2)
  const precioRel = clamp(precioRealPromedio / precioIdealPromedio, 0.5, 2)
  const ratioResto = Math.max(0.2, (config.pesoRestoMercado / Math.max(0.05, 1 - config.pesoRestoMercado)) / (publicidadRel * coberturaRel * calidadRel * Math.pow(1 / precioRel, 0.8)))

  // ----- Cobertura regional por empresa (doc §8)
  const coberturaPorEquipo: Record<string, Record<string, number>> = {}
  for (const m of activas) {
    const total = m.vendedores.reduce((a, b) => a + b, 0)
    coberturaPorEquipo[m.equipoId] = coberturaPorEquipo[m.equipoId] ?? {}
    for (const r of config.regiones) {
      const actual = coberturaPorEquipo[m.equipoId][r.id] ?? 0
      coberturaPorEquipo[m.equipoId][r.id] = Math.max(actual, coberturaRegional(total, r.factorLogistico))
    }
  }

  // ----- Distribución mensual de la producción según la estacionalidad del mercado
  const factoresProm = meses.map((_, i) => 1 + 1.0 * (config.estacionalidad.factores[i] - 1))
  const sumaFactores = factoresProm.reduce((s, f) => s + f, 0)
  const shareProduccion = factoresProm.map((f) => f / sumaFactores)

  const inventarioMarca = new Map(activas.map((m) => [m.marcaId, Math.max(0, m.inventario)]))
  const ventasMensualMarca = new Map(activas.map((m) => [m.marcaId, Array(12).fill(0)]))
  const ventasMensualResto: number[] = Array(12).fill(0)
  const demandaMensualTotal: number[] = Array(12).fill(0)
  const ventasRegionEquipo: Record<string, Record<string, number>> = {}
  const ventasSegmentoMarca = new Map(activas.map((m) => [m.marcaId, new Map<string, number>()]))
  const ventasCanalMarca = new Map(activas.map((m) => [m.marcaId, new Map<string, number>()]))
  const sinStockMarca = new Map(activas.map((m) => [m.marcaId, false]))
  let quiebresStock = 0
  const merma = config.produccion.merma

  for (const mes of meses) {
    const idx = mes - 1

    // 1) Producción del mes entra al inventario (con merma, doc §5)
    for (const m of activas) {
      const prodMes = produccionDisponible[m.marcaId] * shareProduccion[idx]
      inventarioMarca.set(m.marcaId, (inventarioMarca.get(m.marcaId) ?? 0) + prodMes * (1 - merma))
    }

    // 2) Pérdidas de inventario por interrupciones logísticas / refrigeración (doc §5, §10.4)
    let perdidaFrioMes = 0
    for (const region of config.regiones) {
      const f = eventos.logistica[region.id]?.[idx] ?? eventos.logistica['NACIONAL']?.[idx] ?? 1
      perdidaFrioMes = Math.max(perdidaFrioMes, 1 - f)
    }
    if (perdidaFrioMes > 0) {
      const fraccion = Math.min(0.3, perdidaFrioMes * 0.15)
      for (const m of activas) {
        inventarioMarca.set(m.marcaId, (inventarioMarca.get(m.marcaId) ?? 0) * (1 - fraccion))
      }
    }

    // 3) Primera pasada: demanda por marca en cada región y segmento
    const demandaMarca = new Map(activas.map((m) => [m.marcaId, 0]))
    let demandaRestoMes = 0
    const detRegion: Record<string, Record<string, number>> = {}
    const detSeg = new Map(activas.map((m) => [m.marcaId, new Map<string, number>()]))
    const detCanal = new Map(activas.map((m) => [m.marcaId, new Map<string, number>()]))

    for (const region of config.regiones) {
      const factorMes = config.estacionalidad.factores[idx]
      const k = config.estacionalidad.kZona[region.zona] ?? 1
      const factorEstacional = 1 + k * (factorMes - 1)
      const factorEvento = eventos.demanda[region.id]?.[idx] ?? eventos.demanda['NACIONAL']?.[idx] ?? 1

      for (const seg of config.segmentos) {
        const demandaRegionSeg = (demandaSegmentos[seg.id] / 12) * region.pesoEfectivo * factorEstacional * factorEvento
        demandaMensualTotal[idx] += demandaRegionSeg

        const puntajes = activas.map((m) => {
          const a = atractivos[m.marcaId][seg.id] ?? 0
          const cob = coberturaPorEquipo[m.equipoId][region.id] ?? 1
          return { m, p: a * (0.5 + 0.5 * (cob / 10)) }
        })
        const sumaEmpresas = puntajes.reduce((s, x) => s + x.p, 0)
        const pResto = sumaEmpresas * ratioResto
        const total = sumaEmpresas + pResto
        if (total <= 0) continue

        for (const { m, p } of puntajes) {
          const d = (demandaRegionSeg * p) / total
          demandaMarca.set(m.marcaId, (demandaMarca.get(m.marcaId) ?? 0) + d)
          detSeg.get(m.marcaId)!.set(seg.id, (detSeg.get(m.marcaId)!.get(seg.id) ?? 0) + d)
          const canalExtra = config.canales.map((c) => (c.id === 'horeca' ? Math.max(0, eventos.demandaHoreca[idx] - 1) : 0))
          const sumaCanalPeso = config.canales.reduce((s, c, i) => s + c.participacion * (1 + canalExtra[i]), 0)
          config.canales.forEach((c, i) => {
            const peso = (c.participacion * (1 + canalExtra[i])) / sumaCanalPeso
            detCanal.get(m.marcaId)!.set(c.id, (detCanal.get(m.marcaId)!.get(c.id) ?? 0) + d * peso)
          })
          detRegion[m.equipoId] = detRegion[m.equipoId] ?? {}
          detRegion[m.equipoId][region.id] = (detRegion[m.equipoId][region.id] ?? 0) + d
        }
        demandaRestoMes += (demandaRegionSeg * pResto) / total
      }
    }

    // 4) Segunda pasada: ventas limitadas por el inventario disponible (reparto proporcional)
    for (const m of activas) {
      const d = demandaMarca.get(m.marcaId) ?? 0
      const disp = inventarioMarca.get(m.marcaId) ?? 0
      const venta = Math.min(d, disp)
      inventarioMarca.set(m.marcaId, Math.max(0, disp - venta))
      ventasMensualMarca.get(m.marcaId)![idx] = venta
      if (d > disp * 1.02) {
        sinStockMarca.set(m.marcaId, true)
        quiebresStock++
      }
      if (d > 0) {
        const ratio = venta / d
        const mapaSeg = ventasSegmentoMarca.get(m.marcaId)!
        for (const [segId, v] of detSeg.get(m.marcaId)!) mapaSeg.set(segId, (mapaSeg.get(segId) ?? 0) + v * ratio)
        const mapaCanal = ventasCanalMarca.get(m.marcaId)!
        for (const [canalId, v] of detCanal.get(m.marcaId)!) mapaCanal.set(canalId, (mapaCanal.get(canalId) ?? 0) + v * ratio)
        ventasRegionEquipo[m.equipoId] = ventasRegionEquipo[m.equipoId] ?? {}
        for (const [regionId, v] of Object.entries(detRegion[m.equipoId] ?? {})) {
          ventasRegionEquipo[m.equipoId][regionId] = (ventasRegionEquipo[m.equipoId][regionId] ?? 0) + v * ratio
        }
      }
    }
    ventasMensualResto[idx] = demandaRestoMes
  }

  // ----- Resultados por marca
  const resultados: ResultadoMarca[] = []
  for (const m of activas) {
    const ventas = ventasMensualMarca.get(m.marcaId)!.reduce((s, v) => s + v, 0)
    const produccion = produccionDisponible[m.marcaId]
    const inventarioFinal = inventarioMarca.get(m.marcaId) ?? 0
    const precioSinIva = m.precio / (1 + config.impuestos.iva)
    const ingresos = round1(ventas * precioSinIva)
    const costoLitro = costoLitroDesdeAtributos(insumosBase0, m.atributos, inflacionCostos)
    const costoProductos = round1(ventas * costoLitro)
    const costoInventario = round1(inventarioFinal * costoLitro * config.produccion.almacenamiento * 0.5)
    const costos = round2(costoProductos + costoInventario)
    const fuerzaVentas = round1(costoFuerzaVentas(m.vendedores))
    const contribucion = round1(ingresos - costos - m.publicidad - fuerzaVentas)

    const mapaSeg = ventasSegmentoMarca.get(m.marcaId)!
    const porSegmento = config.segmentos.map((seg) => {
      const v = round1(mapaSeg.get(seg.id) ?? 0)
      return { segmentoId: seg.id, ventas: v, ingresos: round1(v * precioSinIva) }
    })
    const mapaCanal = ventasCanalMarca.get(m.marcaId)!
    const sumaCanal = [...mapaCanal.values()].reduce((s, v) => s + v, 0) || 1
    const porCanal = config.canales.map((canal) => {
      const v = round1(ventas * ((mapaCanal.get(canal.id) ?? 0) / sumaCanal))
      return { canalId: canal.id, ventas: v, ingresos: round1(v * precioSinIva) }
    })

    const awarenessNueva = clamp(0.65 * m.awareness + 0.45 * Math.sqrt(Math.max(0, m.publicidad) / 400), 0.02, 0.95)

    resultados.push({
      marcaId: m.marcaId,
      equipoId: m.equipoId,
      nombre: m.nombre,
      ventas: round1(ventas),
      produccion: round1(produccion),
      inventarioFinal: round1(inventarioFinal),
      ingresos,
      costos,
      publicidad: round1(m.publicidad),
      fuerzaVentas,
      contribucion,
      porSegmento,
      porCanal,
      sinStock: sinStockMarca.get(m.marcaId) ?? false,
      awarenessNueva: round2(awarenessNueva),
      ventasMensual: ventasMensualMarca.get(m.marcaId)!.map(round1),
      precioReal: round2((100 * m.precio) / indiceFin),
    })
  }

  // ----- Agregados por equipo + finanzas (IVA, IT, IUE, intereses — doc §9, §18.9)
  const ventasEmpresasTotal = resultados.reduce((s, r) => s + r.ventas, 0)
  const ventasRestoTotal = ventasMensualResto.reduce((s, v) => s + v, 0)
  const ventasTotalesMercado = ventasEmpresasTotal + ventasRestoTotal
  const equipoIds = [...new Set(activas.map((m) => m.equipoId))]

  const equipos: ResultadoEquipo[] = equipoIds.map((equipoId) => {
    const rs = resultados.filter((r) => r.equipoId === equipoId)
    const ventas = round1(rs.reduce((s, r) => s + r.ventas, 0))
    const ingresos = round1(rs.reduce((s, r) => s + r.ingresos, 0)) // netos de IVA (doc §9.2)
    const ingresosBrutos = round1(ingresos * (1 + config.impuestos.iva))
    const iva = round1(ingresosBrutos - ingresos)

    const costoProductos = round1(rs.reduce((s, r) => s + r.costos, 0))
    const inventarioFinal = round1(rs.reduce((s, r) => s + r.inventarioFinal, 0))

    // logística: 6% de las ventas ponderado por el factor logístico regional (doc §8)
    const porRegion = config.regiones.map((r) => ({ regionId: r.id, ventas: round1(ventasRegionEquipo[equipoId]?.[r.id] ?? 0) }))
    const sumaRegion = porRegion.reduce((s, x) => s + x.ventas, 0) || 1
    const factorLogPonderado = porRegion.reduce((s, x) => {
      const r = config.regiones.find((rr) => rr.id === x.regionId)!
      return s + (x.ventas / sumaRegion) * r.factorLogistico
    }, 0)
    const logistica = round1(config.distribucion.costoLogisticoPct * ingresos * factorLogPonderado)
    const perdidasCadenaFrio = round1(config.distribucion.perdidasCadenaFrio * costoProductos)

    // marketing (doc §7): rubros en % de ventas se escalan solos con la inflación (doc §18.9)
    const promocion = round1(0.03 * ingresos)
    const investigacionMercado = round1(0.05 * ingresos)
    const comisionVendedores = round1(0.03 * ingresos)
    const publicidad = round1(rs.reduce((s, r) => s + r.publicidad, 0))
    const fuerzaVentas = round1(rs.reduce((s, r) => s + r.fuerzaVentas, 0))

    // tope del presupuesto comercial: 20% de las ventas (doc §7); el exceso se recorta
    const comercial = publicidad + promocion + investigacionMercado + comisionVendedores
    const topeComercial = 0.2 * ingresos
    const factorComercial = comercial > topeComercial && comercial > 0 ? topeComercial / comercial : 1

    // inversión en capacidad indexada por inflación y tipo de cambio (doc §5, §18.7)
    const inversion = clamp(ctx.inversionCapacidad[equipoId] ?? 0, 0, Math.max(0, (ctx.capacidad[equipoId]?.maxima ?? 3000) - (ctx.capacidad[equipoId]?.instalada ?? 1000)))
    const tcoRel = macro.tipoCambioFinal / macro.tipoCambioInicio
    const costoCapacidadUnitario = config.produccion.costoCapacidadLitro * (0.3 + 0.7 * tcoRel) * (1 + macro.piAnual * 0.5)
    const costoCapacidad = round1(inversion * costoCapacidadUnitario)

    const publicidadFinal = round1(publicidad * factorComercial)
    const costoTotal = costoProductos + logistica + perdidasCadenaFrio
      + promocion * factorComercial + investigacionMercado * factorComercial + comisionVendedores * factorComercial
      + publicidadFinal + fuerzaVentas
    const utilidadOperativa = round1(ingresos - costoTotal)
    const margenBruto = ingresos > 0 ? round2((ingresos - costoProductos - perdidasCadenaFrio) / ingresos) : 0
    const margenOperativo = ingresos > 0 ? round2(utilidadOperativa / ingresos) : 0

    // deuda e intereses (doc §9.1): endeudamiento máx 60% de las ventas
    const deudaInicial = ctx.deuda[equipoId] ?? 0
    const intereses = round1(deudaInicial * macro.tasaInteres)
    const utilidadPreImpuestos = utilidadOperativa - intereses
    const it = round1(Math.max(0, ingresos) * config.impuestos.it)
    const baseIUE = Math.max(0, utilidadPreImpuestos - it)
    const iue = round1(baseIUE * config.impuestos.iue)
    const utilidadNeta = round1(utilidadPreImpuestos - it - iue)

    const necesidadFinanciamiento = Math.max(0, costoCapacidad - Math.max(0, utilidadNeta))
    const deudaMax = config.finanzas.endeudamientoMaximo * Math.max(0, ingresos)
    const deudaFinal = round1(Math.min(deudaMax, (deudaInicial + necesidadFinanciamiento) * 0.9))
    const endeudamientoAviso = necesidadFinanciamiento > 0 && deudaFinal >= deudaMax - 1e-6

    const capInstalada = capacidadEquipo[equipoId] ?? 1000
    const produccionEquipo = rs.reduce((s, r) => s + r.produccion, 0)
    const roi = (() => {
      const capital = Math.max(1, capInstalada * costoCapacidadUnitario + deudaFinal)
      return round2((utilidadNeta / capital) * 100)
    })()

    return {
      equipoId,
      ventas,
      ingresos,
      costos: round1(costoTotal),
      publicidad: publicidadFinal,
      fuerzaVentas,
      contribucion: round1(rs.reduce((s, r) => s + r.contribucion, 0)),
      participacion: ventasEmpresasTotal > 0 ? round2((ventas / ventasEmpresasTotal) * 100) : 0,
      participacionTotal: ventasTotalesMercado > 0 ? round2((ventas / ventasTotalesMercado) * 100) : 0,
      porRegion,
      finanzas: {
        ingresosBrutos, ingresosNetos: ingresos, iva,
        costoProductos, almacenamiento: 0, logistica, perdidasCadenaFrio,
        promocion: round1(promocion * factorComercial), investigacionMercado: round1(investigacionMercado * factorComercial),
        comisionVendedores: round1(comisionVendedores * factorComercial),
        publicidad: publicidadFinal, fuerzaVentas,
        costoCapacidad,
        utilidadOperativa, margenBruto, margenOperativo,
        intereses, it, iue, utilidadNeta,
        deudaFinal, endeudamientoAviso, roi,
      },
      produccionAnio: {
        capacidadInstalada: round1(capInstalada),
        capacidadUtilizada: round1(produccionEquipo),
        utilizacionPct: capInstalada > 0 ? round2((produccionEquipo / capInstalada) * 100) : 0,
        merma: round1(produccionEquipo * merma),
        inversionCapacidad: round1(inversion),
        inventarioFinal,
        quiebresStock,
      },
    }
  })

  return {
    anio,
    marcas: resultados,
    equipos,
    demandaTotal: round1(demandaAnioTotal),
    ventasTotales: round1(ventasTotalesMercado),
    ventasEmpresas: round1(ventasEmpresasTotal),
    ventasResto: round1(ventasRestoTotal),
    capturaEmpresas: ventasTotalesMercado > 0 ? round2((ventasEmpresasTotal / ventasTotalesMercado) * 100) : 0,
    detalleMensual: meses.map((mes, i) => ({
      mes,
      demandaTotal: round1(demandaMensualTotal[i]),
      ventasEmpresas: round1([...ventasMensualMarca.values()].reduce((s, arr) => s + arr[i], 0)),
      ventasResto: round1(ventasMensualResto[i]),
    })),
    eventosTrazabilidad: eventos.trazabilidad,
    macroResumen: {
      piAnual: macro.piAnual,
      indicePreciosFin: round2(indiceFin),
      tipoCambioFinal: round2(macro.tipoCambioFinal),
      tasasComponentes: macro.tasasComponentes,
    },
  }
}

// ===================== HISTORIA · Años anteriores al Año 1 =====================

export interface MarcaHistoria {
  marcaId: string
  equipoId: string
  nombre: string
  precio: number
  publicidad: number
  costoUnitario: number
  vendedores: number[]
}

/**
 * Historia del mercado previa a la gestión de los estudiantes (Años -2, -1, 0).
 * Participaciones parejas ±15% con leve evolución, producción = ventas,
 * costo de transferencia 55%. El doc §1.2 dimensiona el Año 0 con el Resto
 * del mercado, así que las participaciones se reportan sobre el mercado total.
 */
export function reportesHistoria(
  marcas: MarcaHistoria[],
  anios: number[],
  config?: ConfigIndustria
): { anio: number; marcas: ResultadoMarca[]; equipos: ResultadoEquipo[] }[] {
  const porEquipo = new Map<string, MarcaHistoria[]>()
  for (const m of marcas) {
    const arr = porEquipo.get(m.equipoId) ?? []
    arr.push(m)
    porEquipo.set(m.equipoId, arr)
  }

  const pesoBase = 1 / Math.max(1, porEquipo.size)
  // captura inicial de las empresas sobre el mercado total (doc §1.2 ≈ 22%)
  const captura = config ? 1 - config.pesoRestoMercado : 0.22
  const indices: Record<number, number> = {}
  let idx = 100
  for (const a of [...anios].sort((x, y) => x - y)) { indices[a] = idx; idx *= 1.057 }
  const salida: { anio: number; marcas: ResultadoMarca[]; equipos: ResultadoEquipo[] }[] = []

  const configSegmentos = config?.segmentos.map((s, i) => ({ id: s.id, peso: s.peso, precioIdeal: s.precioIdeal, ideal: s.ideal }))
    ?? [
      { id: 'ninos', peso: 0.2, precioIdeal: 18, ideal: [9, 5, 9, 4, 6, 3] },
      { id: 'jovenes', peso: 0.25, precioIdeal: 26, ideal: [8, 7, 5, 6, 7, 6] },
      { id: 'familias', peso: 0.3, precioIdeal: 22, ideal: [7, 6, 6, 8, 5, 6] },
      { id: 'premium', peso: 0.15, precioIdeal: 40, ideal: [6, 9, 3, 8, 9, 9] },
      { id: 'saludables', peso: 0.1, precioIdeal: 34, ideal: [5, 7, 2, 7, 8, 10] },
    ]

  for (const anio of anios) {
    const demandaTotalBase = config
      ? config.mercadoTotalAnio0 * Math.pow(1 + config.macro.crecimientoBase, Math.max(0, anio))
      : 15911.466 * Math.pow(1.04, Math.max(0, anio))
    const indiceAnio = indices[anio] ?? 100
    const resultados: ResultadoMarca[] = []

    for (const [equipoId, ms] of porEquipo) {
      const factorEquipo = ruido(`historia|${anio}|${equipoId}`, 0.15)
      const participacionEquipo = clamp(pesoBase * factorEquipo, 0.05, 0.6)
      const ventasEquipo = demandaTotalBase * captura * participacionEquipo

      for (const m of ms) {
        const ventas = round1(ventasEquipo / ms.length)
        const precioSinIva = m.precio / 1.13
        const ingresos = round1(ventas * precioSinIva)
        const costos = round1(ingresos * 0.55)
        const fuerzaVentas = round1(costoFuerzaVentas(m.vendedores))
        const contribucion = round1(ingresos - costos - m.publicidad - fuerzaVentas)
        const pesosCanal = [0.45, 0.35, 0.20].map((p, i) => p * coberturaCanal(m.vendedores[i] ?? 0, i))
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
          porSegmento: configSegmentos.map((seg) => ({
            segmentoId: seg.id,
            ventas: round1(ventas * seg.peso),
            ingresos: round1(ventas * seg.peso * precioSinIva),
          })),
          porCanal: ['tradicional', 'supermercados', 'horeca'].map((id, i) => {
            const v = round1(ventas * (pesosCanal[i] / sumaC))
            return { canalId: id, ventas: v, ingresos: round1(v * precioSinIva) }
          }),
          sinStock: false,
          awarenessNueva: round2(clamp(0.05 + 0.1 * Math.sqrt(m.publicidad / 400), 0.05, 0.4)),
          ventasMensual: Array(12).fill(round1(ventas / 12)),
          precioReal: round2((100 * m.precio) / indiceAnio),
        })
      }
    }

    const ventasTotalesEmpresas = resultados.reduce((s, r) => s + r.ventas, 0)
    const ventasMercadoTotal = demandaTotalBase
    const equipos: ResultadoEquipo[] = [...porEquipo.keys()].map((equipoId) => {
      const rs = resultados.filter((r) => r.equipoId === equipoId)
      const ventas = round1(rs.reduce((s, r) => s + r.ventas, 0))
      const ingresos = round1(rs.reduce((s, r) => s + r.ingresos, 0))
      const costos = round1(rs.reduce((s, r) => s + r.costos, 0))
      const publicidad = round1(rs.reduce((s, r) => s + r.publicidad, 0))
      const fuerzaVentas = round1(rs.reduce((s, r) => s + r.fuerzaVentas, 0))
      const utilidadNeta = round1(rs.reduce((s, r) => s + r.contribucion, 0) * 0.6)
      return {
        equipoId,
        ventas,
        ingresos,
        costos,
        publicidad,
        fuerzaVentas,
        contribucion: round1(rs.reduce((s, r) => s + r.contribucion, 0)),
        participacion: ventasTotalesEmpresas > 0 ? round2((ventas / ventasTotalesEmpresas) * 100) : 0,
        participacionTotal: ventasMercadoTotal > 0 ? round2((ventas / ventasMercadoTotal) * 100) : 0,
        porRegion: [],
        finanzas: {
          ingresosBrutos: round1(ingresos * 1.13), ingresosNetos: ingresos, iva: round1(ingresos * 0.13),
          costoProductos: costos, almacenamiento: 0, logistica: 0, perdidasCadenaFrio: 0,
          promocion: 0, investigacionMercado: 0, comisionVendedores: 0, publicidad, fuerzaVentas,
          costoCapacidad: 0, utilidadOperativa: round1(rs.reduce((s, r) => s + r.contribucion, 0)),
          margenBruto: 0, margenOperativo: 0, intereses: 0, it: 0, iue: 0,
          utilidadNeta, deudaFinal: 0, endeudamientoAviso: false, roi: 0,
        },
        produccionAnio: { capacidadInstalada: 1000, capacidadUtilizada: ventas, utilizacionPct: round2((ventas / 1000) * 100), merma: 0, inversionCapacidad: 0, inventarioFinal: 0, quiebresStock: 0 },
      }
    })

    salida.push({ anio, marcas: resultados, equipos })
  }

  return salida
}
