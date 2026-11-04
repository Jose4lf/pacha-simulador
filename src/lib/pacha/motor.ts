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
import { createHash } from 'crypto'

/** Hash determinista [0,1) — igual que en hash.ts (ya se usa en este módulo). */
function hash01(seed: string): number {
  const h = createHash('sha256').update(seed).digest()
  return h.readUInt32BE(0) / 0x100000000
}

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
  demanda: number // demanda anual dirigida a la marca (antes del límite de stock)
  ventaPerdida: number // demanda insatisfecha por quiebre de stock
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
  demandaEmpresas: number // demanda dirigida a las empresas jugables (miles L)
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

/** Atractivo de una marca para un segmento (0..1), con precio REAL (doc §18.8).
 *  Incluye el EFECTO INMEDIATO de la publicidad (además del awareness que
 *  madura al año siguiente) para que la decisión del año en curso se sienta. */
export function atractivo(
  marca: { nombre: string; precio: number; publicidad: number; atributos: number[]; vendedores: number[]; awareness: number },
  seg: { precioIdeal: number; sensibilidadPrecio: number; sensibilidadPublicidad?: number; pesoPrecio: number; pesoAwareness: number; pesoCanales: number; pesoAjuste: number; ideal: number[] },
  anio: number,
  indicePrecios = 100,
  necesariosCanal = [750, 75, 105]
): number {
  // Precio real: la demanda reacciona al precio deflactado por el índice de precios.
  //  El peso del precio se AMPLIFICA (×2.5) para que la curva de demanda sea
  //  realista: con el peso original, un precio 2.5× el ideal solo perdía ~50 %
  //  de atractivo y vender caro era la estrategia ganadora.
  const precioReal = (100 * marca.precio) / indicePrecios
  const precioRel = precioReal / seg.precioIdeal
  const pesoPrecioEfectivo = seg.pesoPrecio * 2.5
  const scorePrecio = precioRel <= 1 ? 1 : Math.exp(-seg.sensibilidadPrecio * 0.5 * (precioRel - 1))
  const scoreAwareness = clamp(marca.awareness, 0.01, 1)
  // Efecto inmediato de la campaña del año (peso según la sensibilidad del segmento)
  const pesoPublicidad = 0.10 + 0.015 * (seg.sensibilidadPublicidad ?? 6)
  const scorePublicidad = clamp(0.12 + 0.88 * Math.sqrt(clamp(marca.publicidad, 0, 5000) / 450), 0.12, 1)
  let scoreCanales = 0
  for (let c = 0; c < 3; c++) scoreCanales += (0.45 + c * -0.05 + (c === 2 ? 0.05 : 0)) * coberturaCanal(marca.vendedores[c] ?? 0, c, necesariosCanal)
  scoreCanales = clamp(scoreCanales / 0.9, 0, 1)
  // La fuerza de ventas pesa el doble de lo original: era la decisión más
  // invisible del juego (0 vendedores casi no cambiaban la demanda).
  const pesoCanalesEfectivo = seg.pesoCanales * 2
  const scoreAjuste = ajusteProducto(marca.atributos, seg.ideal)
  const base =
    Math.pow(clamp(scorePrecio, 0.01, 1), pesoPrecioEfectivo) *
    Math.pow(scoreAwareness, seg.pesoAwareness) *
    Math.pow(scorePublicidad, pesoPublicidad) *
    Math.pow(clamp(scoreCanales, 0.01, 1), pesoCanalesEfectivo) *
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
  // La capacidad del equipo se REPARTE PROPORCIONALMENTE entre sus marcas:
  // antes la 1.ª marca consumía toda la capacidad y dejaba a las demás con 0.
  const produccionSolicitada: Record<string, number> = {}
  const produccionDisponible: Record<string, number> = {}
  for (const m of activas) {
    produccionSolicitada[m.equipoId] = (produccionSolicitada[m.equipoId] ?? 0) + Math.max(0, m.produccion)
  }
  for (const m of activas) {
    const cap = capacidadEquipo[m.equipoId] ?? 1000
    const solicitado = produccionSolicitada[m.equipoId] ?? 0
    const factor = solicitado > cap ? cap / solicitado : 1
    produccionDisponible[m.marcaId] = Math.max(0, m.produccion) * factor
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

  // ----- Resto del mercado (doc §1.2): vendedores informales/ambulantes.
  //  Modelo nuevo: el resto tiene un ATRACTIVO PROPIO FIJO (marca virtual),
  //  escalado por pesoRestoMercado. Ya NO depende del precio/marketing
  //  PROMEDIO de las empresas: antes, una sola empresa con un precio loco
  //  hundía las ventas de TODAS las demás.
  const atractivoResto: Record<string, number> = {}
  for (const seg of config.segmentos) {
    atractivoResto[seg.id] = atractivo(
      {
        nombre: `RESTO|${seg.id}`,
        precio: seg.precioIdeal, // el informal vende al precio de referencia
        publicidad: 120, // casi no pauta
        atributos: [4, 3, 4, 3, 2, 3], // calidad artesanal desigual
        vendedores: [55, 4, 3], // fuerte en el canal tradicional
        awareness: 0.55, // el mercado informal es bien conocido
      },
      seg, anio, indiceFin, necesariosCanal
    )
  }
  const restoCoberturaRegional: Record<string, number> = {}
  for (const r of config.regiones) {
    restoCoberturaRegional[r.id] = coberturaRegional(62, r.factorLogistico)
  }
  // Escala del resto: representa a MUCHOS vendedores pequeños, no una marca.
  // Calibrado para que, con las empresas en sus valores iniciales, la DEMANDA
  // de las empresas jugables ronde el 20-25 % del mercado total (queda algo
  // de presión de stock: producir también es una decisión).
  const pesoResto = clamp(config.pesoRestoMercado, 0, 0.95)
  const escalaResto = 27 * (pesoResto / 0.78)

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
  // Cobertura PROMEDIO por marca (ponderada por el peso de cada región): se usa
  // para limitar cuánta demanda ajena (quiebre de stock ajeno) puede absorber
  // una marca: sin vendedores no hay estantes donde el cliente sustituto compre.
  const cobPromedioMarca: Record<string, number> = {}
  for (const m of activas) {
    let acc = 0
    for (const r of config.regiones) acc += r.pesoEfectivo * (coberturaPorEquipo[m.equipoId][r.id] ?? 1)
    cobPromedioMarca[m.marcaId] = acc
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
  let demandaEmpresasTotal = 0 // demanda dirigida a las empresas (antes de descontar stock)
  const demandaAnualMarca = new Map(activas.map((m) => [m.marcaId, 0])) // demanda anual por marca
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
          return { m, p: a * (0.25 + 0.75 * (cob / 10)) }
        })
        const sumaEmpresas = puntajes.reduce((s, x) => s + x.p, 0)
        const pResto = escalaResto * (atractivoResto[seg.id] ?? 0.2) * (0.25 + 0.75 * ((restoCoberturaRegional[region.id] ?? 1) / 10))
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

    // 4) Segunda pasada: ventas limitadas por inventario. La demanda que una
    //    marca NO puede servir se REALOCA entre las marcas con stock disponible
    for (const [id, v] of demandaMarca) demandaAnualMarca.set(id, (demandaAnualMarca.get(id) ?? 0) + v)
    for (const v of demandaMarca.values()) demandaEmpresasTotal += v
    //    (proporcional a su demanda original): quedarse sin stock le cuesta al
    //    que lo provoca, no al mercado entero.
    const demandaOriginal = new Map(activas.map((m) => [m.marcaId, demandaMarca.get(m.marcaId) ?? 0]))
    const demandaPendiente = new Map(demandaOriginal)
    const ventasMes = new Map(activas.map((m) => [m.marcaId, 0]))
    const quiebreMes = new Set<string>()
    for (let iter = 0; iter < activas.length + 1; iter++) {
      // a) vender todo lo que se pueda servir
      for (const m of activas) {
        const d = demandaPendiente.get(m.marcaId) ?? 0
        if (d <= 1e-9) continue
        const disp = inventarioMarca.get(m.marcaId) ?? 0
        const venta = Math.min(d, disp)
        if (venta <= 1e-9) continue
        inventarioMarca.set(m.marcaId, Math.max(0, disp - venta))
        ventasMes.set(m.marcaId, (ventasMes.get(m.marcaId) ?? 0) + venta)
        demandaPendiente.set(m.marcaId, d - venta)
      }
      // b) marcas con demanda pendiente y SIN stock → liberan esa demanda
      const enQuiebre = activas.filter((m) => (demandaPendiente.get(m.marcaId) ?? 0) > 1e-9 && (inventarioMarca.get(m.marcaId) ?? 0) <= 1e-9)
      if (enQuiebre.length === 0) break
      const conStock = activas.filter((m) => (demandaOriginal.get(m.marcaId) ?? 0) > 1e-9 && (inventarioMarca.get(m.marcaId) ?? 0) > 1e-9)
      for (const m of enQuiebre) {
        quiebreMes.add(m.marcaId)
        const libera = demandaPendiente.get(m.marcaId) ?? 0
        if (libera <= 1e-9 || conStock.length === 0) {
          demandaPendiente.set(m.marcaId, 0)
          continue
        }
        // Peso de absorción: demanda original de la receptora, LIMITADA por su
        // cobertura. Tope de ventas del mes = demanda propia × clamp(cob/1.5, 1, 4):
        // una marca sin vendedores NO captura los clientes que otra perdió.
        const pesos = conStock.map((x) => {
          const dOrig = demandaOriginal.get(x.marcaId) ?? 0
          const cap = dOrig * clamp((cobPromedioMarca[x.marcaId] ?? 1) / 1.5, 1, 4)
          const yaVendido = ventasMes.get(x.marcaId) ?? 0
          const margen = Math.max(0, cap - yaVendido - (demandaPendiente.get(x.marcaId) ?? 0))
          return { x, peso: Math.min(dOrig, margen) }
        })
        const sumaPesos = pesos.reduce((s, p) => s + p.peso, 0)
        if (sumaPesos <= 1e-9) continue
        for (const { x, peso } of pesos) {
          const parte = libera * (peso / sumaPesos)
          demandaPendiente.set(x.marcaId, (demandaPendiente.get(x.marcaId) ?? 0) + parte)
        }
        demandaPendiente.set(m.marcaId, 0)
      }
    }
    for (const m of activas) {
      const d = demandaOriginal.get(m.marcaId) ?? 0
      const venta = ventasMes.get(m.marcaId) ?? 0
      ventasMensualMarca.get(m.marcaId)![idx] = venta
      if (quiebreMes.has(m.marcaId)) {
        sinStockMarca.set(m.marcaId, true)
        quiebresStock++
      }
      if (d > 1e-9) {
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
    const demanda = Math.round(demandaAnualMarca.get(m.marcaId) ?? 0)
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
      demanda,
      ventaPerdida: Math.max(0, round1(demanda - ventas)),
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
    demandaEmpresas: round1(demandaEmpresasTotal),
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
 * Participaciones parejas ±15% con leve evolución y variación TAMBIÉN por marca
 * (cada empresa llega con una posición distinta), estacionalidad mensual real de
 * helados en Bolivia (verano dic-feb alto, invierno bajo), costos indexados a la
 * inflación histórica y un estado de resultados completo (logística, promoción,
 * comisiones, IT, IUE). Producción = ventas, costo de transferencia ~55%.
 * El doc §1.2 dimensiona el Año 0 con el Resto del mercado, así que las
 * participaciones se reportan sobre el mercado total.
 */
export interface HistoriaAnio {
  anio: number
  marcas: ResultadoMarca[]
  equipos: ResultadoEquipo[]
  mercado: { demandaTotal: number; ventasEmpresas: number; ventasResto: number; capturaEmpresas: number }
  detalleMensual: { mes: number; demandaTotal: number; ventasEmpresas: number; ventasResto: number }[]
}

export function reportesHistoria(
  marcas: MarcaHistoria[],
  anios: number[],
  config?: ConfigIndustria
): HistoriaAnio[] {
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
  const salida: HistoriaAnio[] = []

  const configSegmentos = config?.segmentos.map((s, i) => ({ id: s.id, peso: s.peso, precioIdeal: s.precioIdeal, ideal: s.ideal }))
    ?? [
      { id: 'ninos', peso: 0.2, precioIdeal: 18, ideal: [9, 5, 9, 4, 6, 3] },
      { id: 'jovenes', peso: 0.25, precioIdeal: 26, ideal: [8, 7, 5, 6, 7, 6] },
      { id: 'familias', peso: 0.3, precioIdeal: 22, ideal: [7, 6, 6, 8, 5, 6] },
      { id: 'premium', peso: 0.15, precioIdeal: 40, ideal: [6, 9, 3, 8, 9, 9] },
      { id: 'saludables', peso: 0.1, precioIdeal: 34, ideal: [5, 7, 2, 7, 8, 10] },
    ]

  // Peso de cada región (por habitantes) para repartir las ventas históricas
  const regionesHistoria = config?.regiones ?? [
    { id: 'santa_cruz', habitantes: 3122605 },
    { id: 'la_paz', habitantes: 3030917 },
    { id: 'cochabamba', habitantes: 2016357 },
    { id: 'potosi', habitantes: 861292 },
    { id: 'chuquisaca', habitantes: 606027 },
    { id: 'oruro', habitantes: 571471 },
    { id: 'tarija', habitantes: 534210 },
    { id: 'beni', habitantes: 488260 },
    { id: 'pando', habitantes: 134194 },
  ]
  const pobTotal = regionesHistoria.reduce((s, r) => s + r.habitantes, 0) || 1

  // Estacionalidad mensual de helados en Bolivia: verano (dic-feb) alto, invierno (jun-ago) bajo
  const ESTACION = [1.18, 1.12, 1.06, 0.96, 0.86, 0.8, 0.84, 0.9, 0.96, 1.02, 1.08, 1.22]

  for (const anio of anios) {
    const demandaTotalBase = config
      ? config.mercadoTotalAnio0 * Math.pow(1 + config.macro.crecimientoBase, Math.max(0, anio))
      : 15911.466 * Math.pow(1.04, Math.max(0, anio))
    const indiceAnio = indices[anio] ?? 100
    // Estacionalidad del mercado con leve variación por año
    const estAnio = ESTACION.map((v, mes) => v * ruido(`historia|mercado|${anio}|${mes}`, 0.05))
    const sumaEstAnio = estAnio.reduce((s, v) => s + v, 0)
    const resultados: ResultadoMarca[] = []

    for (const [equipoId, ms] of porEquipo) {
      const factorEquipo = ruido(`historia|${anio}|${equipoId}`, 0.15)
      const participacionEquipo = clamp(pesoBase * factorEquipo, 0.05, 0.6)
      const ventasEquipo = demandaTotalBase * captura * participacionEquipo

      // Cada marca pesa distinto dentro de la empresa (variación realista por marca)
      const factoresMarca = ms.map((m) => ruido(`historia|${anio}|${equipoId}|${m.marcaId}`, 0.28))
      const sumaMarca = factoresMarca.reduce((s, f) => s + f, 0) || 1

      for (let mi = 0; mi < ms.length; mi++) {
        const m = ms[mi]
        const ventas = round1((ventasEquipo * factoresMarca[mi]) / sumaMarca)
        const precioSinIva = m.precio / 1.13
        const ingresos = round1(ventas * precioSinIva)
        const costos = round1(ingresos * (0.52 + hash01(`historia|costo|${anio}|${m.marcaId}`) * 0.08))
        const fuerzaVentas = round1(costoFuerzaVentas(m.vendedores))
        const contribucion = round1(ingresos - costos - m.publicidad - fuerzaVentas)
        const pesosCanal = [0.45, 0.35, 0.20].map((p, i) => p * coberturaCanal(m.vendedores[i] ?? 0, i))
        const sumaC = pesosCanal.reduce((s, p) => s + p, 0) || 1
        // Estacionalidad con leve variación por marca y año
        const estMarca = ESTACION.map((v, i) => v * ruido(`historia|est|${anio}|${m.marcaId}|${i}`, 0.08))
        const sumaEst = estMarca.reduce((s, v) => s + v, 0)
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
          demanda: ventas,
          ventaPerdida: 0,
          awarenessNueva: round2(clamp(0.05 + 0.1 * Math.sqrt(m.publicidad / 400), 0.05, 0.4)),
          ventasMensual: estMarca.map((v) => round1((ventas * v) / sumaEst)),
          precioReal: round2((100 * m.precio) / indiceAnio),
        })
      }
    }

    const ventasTotalesEmpresas = resultados.reduce((s, r) => s + r.ventas, 0)
    const ventasMercadoTotal = demandaTotalBase

    // Mensual agregado de la industria jugable (estacionalidad incluida) y Resto del mercado
    const detalleMensual = Array.from({ length: 12 }, (_, mes) => {
      const ventasEmpresasMes = round1(resultados.reduce((s, r) => s + (r.ventasMensual[mes] ?? 0), 0))
      return {
        mes: mes + 1,
        demandaTotal: round1((ventasMercadoTotal * estAnio[mes]) / sumaEstAnio),
        ventasEmpresas: ventasEmpresasMes,
        ventasResto: round1(Math.max(0, (ventasMercadoTotal * estAnio[mes]) / sumaEstAnio - ventasEmpresasMes)),
      }
    })

    const equipos: ResultadoEquipo[] = [...porEquipo.keys()].map((equipoId) => {
      const rs = resultados.filter((r) => r.equipoId === equipoId)
      const ventas = round1(rs.reduce((s, r) => s + r.ventas, 0))
      const ingresos = round1(rs.reduce((s, r) => s + r.ingresos, 0))
      const costos = round1(rs.reduce((s, r) => s + r.costos, 0))
      const publicidad = round1(rs.reduce((s, r) => s + r.publicidad, 0))
      const fuerzaVentas = round1(rs.reduce((s, r) => s + r.fuerzaVentas, 0))
      const contribucion = round1(rs.reduce((s, r) => s + r.contribucion, 0))

      // Gastos operativos históricos coherentes con el motor (doc §7-§9)
      const logistica = round1(0.06 * ingresos)
      const perdidasCadenaFrio = round1(0.02 * costos)
      const promocion = round1(0.03 * ingresos)
      const investigacionMercado = round1(0.05 * ingresos)
      const comisionVendedores = round1(0.03 * ingresos)
      const utilidadOperativa = round1(contribucion - logistica - perdidasCadenaFrio - promocion - investigacionMercado - comisionVendedores)
      const it = round1(0.03 * ingresos)
      const utilidadAntesIUE = round1(utilidadOperativa - it)
      const iue = round1(Math.max(0, 0.25 * utilidadAntesIUE))
      const utilidadNeta = round1(utilidadAntesIUE - iue)

      // Ventas históricas repartidas por población de cada departamento
      const porRegion = regionesHistoria.map((r) => ({
        regionId: r.id,
        ventas: round1(ventas * (r.habitantes / pobTotal)),
      }))

      return {
        equipoId,
        ventas,
        ingresos,
        costos,
        publicidad,
        fuerzaVentas,
        contribucion,
        participacion: ventasTotalesEmpresas > 0 ? round2((ventas / ventasTotalesEmpresas) * 100) : 0,
        participacionTotal: ventasMercadoTotal > 0 ? round2((ventas / ventasMercadoTotal) * 100) : 0,
        porRegion,
        finanzas: {
          ingresosBrutos: round1(ingresos * 1.13), ingresosNetos: ingresos, iva: round1(ingresos * 0.13),
          costoProductos: costos, almacenamiento: 0, logistica, perdidasCadenaFrio,
          promocion, investigacionMercado, comisionVendedores, publicidad, fuerzaVentas,
          costoCapacidad: 0, utilidadOperativa,
          margenBruto: ingresos > 0 ? round2((ingresos - costos) / ingresos) : 0,
          margenOperativo: ingresos > 0 ? round2(utilidadOperativa / ingresos) : 0,
          intereses: 0, it, iue,
          utilidadNeta, deudaFinal: 0, endeudamientoAviso: false,
          roi: ingresos > 0 ? round2(utilidadNeta / ingresos) : 0,
        },
        produccionAnio: {
          capacidadInstalada: 1000, capacidadUtilizada: ventas,
          utilizacionPct: round2((ventas / 1000) * 100), merma: 0,
          inversionCapacidad: 0, inventarioFinal: 0, quiebresStock: 0,
        },
      }
    })

    salida.push({
      anio,
      marcas: resultados,
      equipos,
      mercado: {
        demandaTotal: round1(ventasMercadoTotal),
        ventasEmpresas: round1(ventasTotalesEmpresas),
        ventasResto: round1(Math.max(0, ventasMercadoTotal - ventasTotalesEmpresas)),
        capturaEmpresas: ventasMercadoTotal > 0 ? round2((ventasTotalesEmpresas / ventasMercadoTotal) * 100) : 0,
      },
      detalleMensual,
    })
  }

  return salida
}
