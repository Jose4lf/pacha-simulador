// ============================================================
// PACHA Simulador · Pruebas del módulo Bolivia (doc §17, §18.12)
// Ejecutar: bun test tests/motor-bolivia.test.ts
// ============================================================

import { describe, expect, test } from 'bun:test'
import {
  CANALES_BOLIVIA, COSTOS, ESTACIONALIDAD, GENERAL, MERCADO, REGIONES, SEGMENTOS_BOLIVIA,
  crearConfigIndustria, mercadoTotalAnio0, ofertaEmpresasAnio0, validarConfiguracion,
} from '@/lib/pacha/config-bolivia'
import { agruparEfectos, elegirEventosAuto, mesesDeEvento, pascua, resolverEventosDesdePlan, senalesInflacionDesdeEventos, type EventoDef } from '@/lib/pacha/eventos'
import {
  calcularInflacion, deltaEscenario, indicePrecios, margenNeutral, poderAdquisitivoReal,
  sortearEscenario, tasaComponente, tasaMensualEquivalente, tasasMensualesComponente,
  type LimitesInflacion,
} from '@/lib/pacha/inflacion'
import { simularAnioBolivia, type ContextoAnio, type MarcaSim } from '@/lib/pacha/motor'

const LIMITES: LimitesInflacion = {
  piso: 0,
  techo: 0.3,
  limiteFactores: 0.05,
  escenarios: {
    FAVORABLE: { probabilidad: 0.25, deltaMin: -0.02, deltaMax: -0.005 },
    ESTABLE: { probabilidad: 0.5, deltaMin: -0.005, deltaMax: 0.005 },
    DESFAVORABLE: { probabilidad: 0.25, deltaMin: 0.01, deltaMax: 0.04 },
  },
  factoresMax: { combustibles: 0.01, tipo_cambio: 0.015, leche: 0.005, azucar_frutas: 0.005, envases: 0.003, transporte: 0.005, abastecimiento: 0.01, clima: 0.007, actividad: 0.01 },
}

describe('1. Datos oficiales de Bolivia (doc §1.1, §2, §3, §6, §12)', () => {
  test('la población por región suma exactamente 11.365.333', () => {
    const suma = REGIONES.reduce((s, r) => s + r.habitantes, 0)
    expect(suma).toBe(11365333)
    expect(GENERAL.poblacionTotal.valor).toBe(11365333)
  })

  test('los porcentajes de población se calculan y no se escriben a mano', () => {
    const config = crearConfigIndustria(5)
    const sumaPesos = config.regiones.reduce((s, r) => s + r.peso, 0)
    expect(Math.abs(sumaPesos - 1)).toBeLessThan(1e-9)
    for (const r of config.regiones) {
      expect(r.peso).toBeCloseTo(r.habitantes / GENERAL.poblacionTotal.valor, 9)
    }
  })

  test('los pesos de segmentos suman 100%', () => {
    const suma = SEGMENTOS_BOLIVIA.reduce((s, x) => s + x.peso, 0)
    expect(suma).toBeCloseTo(1, 9)
  })

  test('las participaciones de canales suman 100%', () => {
    const suma = CANALES_BOLIVIA.reduce((s, x) => s + x.participacion, 0)
    expect(suma).toBeCloseTo(1, 9)
  })

  test('la estructura de costos suma 100% con las proporciones del doc §6', () => {
    const suma = COSTOS.reduce((s, c) => s + c.peso, 0)
    expect(suma).toBeCloseTo(1, 9)
    const leche = COSTOS.find((c) => c.id === 'leche')!
    expect(leche.peso).toBe(0.35)
    expect(leche.importado).toBe(0.1)
  })

  test('la estacionalidad normalizada tiene promedio anual 1,0 (doc §12)', () => {
    const config = crearConfigIndustria(5)
    const prom = config.estacionalidad.factores.reduce((s, f) => s + f, 0) / 12
    expect(prom).toBeCloseTo(1, 9)
    // los índices ilustrativos suman 98 (promedio 8,17)
    const sumaIdx = ESTACIONALIDAD.indices.reduce((s, x) => s + x, 0)
    expect(sumaIdx).toBe(98)
  })

  test('validarConfiguracion() pasa sin errores', () => {
    const v = validarConfiguracion()
    expect(v.ok).toBe(true)
    expect(v.errores).toHaveLength(0)
  })
})

describe('2. Dimensionamiento del Año 0 (doc §1.2)', () => {
  test('mercado total = 11.365.333 × 1,4 = 15.911.466 litros', () => {
    expect(mercadoTotalAnio0()).toBe(15911466)
  })

  test('oferta de las 5 empresas = 5 × (1.000.000 × 70%) = 3.500.000 litros (22,0%)', () => {
    const oferta = ofertaEmpresasAnio0(5)
    expect(oferta).toBe(3500000)
    const captura = oferta / mercadoTotalAnio0()
    expect(captura).toBeCloseTo(0.22, 2)
  })

  test('el Resto del mercado recibe el 78% en la config de 5 empresas', () => {
    const config = crearConfigIndustria(5)
    expect(config.pesoRestoMercado).toBeCloseTo(0.78, 2)
  })

  test('capacidad inicial 1.000.000 L y máxima 3.000.000 L (doc §5)', () => {
    expect(MERCADO.capacidadInicialLitros.valor).toBe(1000000)
    expect(MERCADO.capacidadMaximaLitros.valor).toBe(3000000)
  })
})

describe('3. Fechas móviles: Pascua (doc §10.1)', () => {
  test('Pascua 2026 es el 5 de abril y Carnaval cae 47 días antes', () => {
    const p = pascua(2026)
    expect(p.getUTCDate()).toBe(5)
    expect(p.getUTCMonth() + 1).toBe(4)
    const carnaval = mesesDeEvento({ regla: 'PASCUA-47', mesesDuracion: 1 }, 2026)
    expect(carnaval).toEqual([2]) // 17 de febrero de 2026
  })

  test('Semana Santa (PASCUA-0) cae en el mes de Pascua', () => {
    expect(mesesDeEvento({ regla: 'PASCUA-0', mesesDuracion: 1 }, 2027)).toEqual([3]) // Pascua 2027: 28 de marzo
  })

  test('fechas fijas y reglas editables se resuelven', () => {
    expect(mesesDeEvento({ regla: '08-06', mesesDuracion: 1 }, 2027)).toEqual([8]) // Aniversario de Bolivia
    expect(mesesDeEvento({ regla: 'EDU-INVERNAL', mesesDuracion: 2 }, 2027)).toEqual([6, 7])
  })
})

describe('4. Motor de eventos: agrupación sin doble conteo (doc §15)', () => {
  const ev = (parcial: Partial<EventoDef>): EventoDef => ({
    nombre: 'X', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1,
    intensidad: 0.5, probabilidad: 1, efectoDemanda: 0, efectoCosto: 0, efectoLogistica: 0,
    signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba', ...parcial,
  })

  test('tres eventos simultáneos sobre la misma variable: pesos 100/50/25', () => {
    const eventos = [
      ev({ nombre: 'A', efectoDemanda: 0.2, region: 'la_paz' }),
      ev({ nombre: 'B', efectoDemanda: 0.1, region: 'la_paz' }),
      ev({ nombre: 'C', efectoDemanda: 0.1, region: 'la_paz' }),
    ].map((e) => ({ ...e, meses: [3], origen: 'CALENDARIO' as const, traza: '' }))
    const g = agruparEfectos(eventos)
    // 0.2 + 0.1×0.5 + 0.1×0.25 = 0.275 → tope +25%
    expect(g.demanda['la_paz'][2]).toBeCloseTo(1.25, 6)
  })

  test('dos eventos del mismo tipo y región: solo el de mayor intensidad', () => {
    const eventos = [
      ev({ nombre: 'Bloqueo de carreteras', efectoDemanda: -0.05, region: 'oruro' }),
      ev({ nombre: 'Bloqueo de carreteras', efectoDemanda: -0.02, region: 'oruro' }),
    ].map((e) => ({ ...e, meses: [4], origen: 'CALENDARIO' as const, traza: '' }))
    const g = agruparEfectos(eventos)
    expect(g.demanda['oruro'][3]).toBeCloseTo(0.95, 6) // −5% solo una vez
  })

  test('los efectos se limitan a los topes de la sección 11', () => {
    const eventos = [ev({ nombre: 'Crisis', efectoDemanda: -0.5, region: 'NACIONAL' })]
      .map((e) => ({ ...e, meses: [1], origen: 'CALENDARIO' as const, traza: '' }))
    const g = agruparEfectos(eventos)
    expect(g.demanda['NACIONAL'][0]).toBeCloseTo(0.8, 6) // mínimo −20%
  })

  test('los eventos de costos alimentan factores de inflación vía traspaso (doc §18.6)', () => {
    const eventos = [{ nombre: 'Escasez de combustible', categoria: 'ECONOMICO' as const, region: 'NACIONAL', meses: [1, 2], efectoDemanda: -0.04, efectoCosto: 0.15, efectoLogistica: 0.1, origen: 'PROBABILISTICO' as const, traza: '' }]
    const senales = senalesInflacionDesdeEventos(eventos, 0.2)
    const combustible = senales.find((s) => s.factor === 'combustibles')!
    expect(combustible).toBeDefined()
    expect(combustible.senal).toBeGreaterThan(0)
    expect(combustible.senal).toBeLessThanOrEqual(1)
  })
})

describe('5. Inflación (doc §18.12, regla 12: pruebas obligatorias)', () => {
  test('piso y techo de πₜ', () => {
    const abajo = calcularInflacion(0.02, -0.05, [], LIMITES)
    expect(abajo.pi).toBe(0) // piso 0%
    const arriba = calcularInflacion(0.29, 0.04, [], LIMITES)
    expect(arriba.pi).toBe(0.3) // techo 30%
  })

  test('la suma de factores se limita a ±5 pp por periodo (doc §18.5)', () => {
    const factores = Object.keys(LIMITES.factoresMax).map((f) => ({ factor: f, senal: 1 }))
    const r = calcularInflacion(0.057, 0, factores, LIMITES)
    expect(r.aporteFactores).toBeCloseTo(0.05, 9)
    expect(r.pi).toBeCloseTo(0.107, 9)
  })

  test('la crisis económica lleva la inflación hasta el techo (doc §18.4)', () => {
    const r = calcularInflacion(0.06, 0, [], LIMITES, true)
    expect(r.pi).toBe(0.3)
  })

  test('equivalencia entre tasa mensual y anual: (1+m)^12 = 1+π', () => {
    for (const pi of [0.057, 0.12, 0.2, 0.3]) {
      const m = tasaMensualEquivalente(pi)
      const anual = Math.pow(1 + m, 12) - 1
      expect(anual).toBeCloseTo(pi, 9)
    }
  })

  test('las 12 tasas mensuales de un componente acumulan π_c anual', () => {
    const tasas = tasasMensualesComponente(0.09)
    expect(tasas).toHaveLength(12)
    const acumulado = tasas.reduce((a, t) => a * (1 + t), 1) - 1
    expect(acumulado).toBeCloseTo(0.09, 9)
  })

  test('cálculo de π_c: la parte importada sigue al TC y no se multiplica por el IPC (doc §18.7)', () => {
    // leche: m=0.1, β=1.0, π=5.7%, f=0, ΔTCO=8% → 0.9×0.057 + 0.1×0.08 = 0.0593
    const leche = tasaComponente(0.1, 1.0, 0.057, 0, 0.08)
    expect(leche).toBeCloseTo(0.9 * 0.057 + 0.1 * 0.08, 9)
    // mano de obra: m=0, β=0.8 → 0.8×π
    const manoObra = tasaComponente(0, 0.8, 0.057, 0, 0.5)
    expect(manoObra).toBeCloseTo(0.8 * 0.057, 9)
    // envases: m=0.4 → 0.6×π + 0.4×ΔTCO
    const envases = tasaComponente(0.4, 1.0, 0.057, 0, 0.08)
    expect(envases).toBeCloseTo(0.6 * 0.057 + 0.4 * 0.08, 9)
  })

  test('prueba de neutralidad: precio y costo suben πₜ → el margen no cambia', () => {
    for (const pi of [0.02, 0.057, 0.15, 0.3]) {
      expect(margenNeutral(pi, 32, 15)).toBe(true)
    }
    expect(margenNeutral(0.057, 32, 15)).toBe(true)
  })

  test('poder adquisitivo real: cae solo si la inflación supera el ingreso nominal (doc §18.8)', () => {
    const pa = poderAdquisitivoReal(0.06, 0.057)
    expect(pa).toBeGreaterThan(0) // 6% nominal > 5,7% inflación
    const pa2 = poderAdquisitivoReal(0.06, 0.15)
    expect(pa2).toBeLessThan(0) // inflación 15% > 6% nominal
  })

  test('el escenario sorteado queda dentro de su rango y la semilla es determinista', () => {
    for (let i = 0; i < 40; i++) {
      const esc = sortearEscenario(`semilla-prueba-${i}`, LIMITES.escenarios)
      const delta = deltaEscenario(`semilla-prueba-${i}`, esc, LIMITES.escenarios)
      const cfg = LIMITES.escenarios[esc]
      expect(delta).toBeGreaterThanOrEqual(cfg.deltaMin - 1e-9)
      expect(delta).toBeLessThanOrEqual(cfg.deltaMax + 1e-9)
      // determinista: misma semilla → mismo resultado
      expect(deltaEscenario(`semilla-prueba-${i}`, esc, LIMITES.escenarios)).toBe(delta)
    }
  })

  test('el índice de precios se encadena (base 100 en el Año 0)', () => {
    expect(indicePrecios(100, 0.057)).toBeCloseTo(105.7, 6)
  })
})

describe('6. Motor mensual: integración (doc §13, §14)', () => {
  function construirContexto(): ContextoAnio {
    const config = crearConfigIndustria(2)
    const marcas: MarcaSim[] = [
      { marcaId: 'm1', equipoId: 'e1', nombre: 'Delizia Agua', precio: 21, publicidad: 300, produccion: 380, costoUnitario: 11.5, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8], inventario: 0, awareness: 0.3 },
      { marcaId: 'm2', equipoId: 'e1', nombre: 'Delizia Crema', precio: 32, publicidad: 380, produccion: 320, costoUnitario: 15.5, atributos: [6, 8, 10, 6, 6, 7], vendedores: [70, 15, 12], inventario: 0, awareness: 0.3 },
      { marcaId: 'm3', equipoId: 'e2', nombre: 'PIL Agua', precio: 20, publicidad: 280, produccion: 400, costoUnitario: 11.5, atributos: [7, 3, 1, 4, 5, 4], vendedores: [85, 12, 6], inventario: 0, awareness: 0.3 },
      { marcaId: 'm4', equipoId: 'e2', nombre: 'PIL Crema', precio: 31, publicidad: 350, produccion: 300, costoUnitario: 15.5, atributos: [6, 8, 10, 6, 6, 7], vendedores: [65, 14, 10], inventario: 0, awareness: 0.3 },
    ]
    return {
      config,
      eventos: { demanda: {}, costo: Array(12).fill(1), logistica: {}, demandaHoreca: Array(12).fill(1), trazabilidad: [] },
      macro: {
        piAnual: 0.057, tasaMensual: tasaMensualEquivalente(0.057), indicePreciosInicio: 100,
        tipoCambioInicio: 11.8, tipoCambioFinal: 12.5, tasaInteres: 0.12,
        tasasComponentes: Object.fromEntries(COSTOS.map((c) => [c.id, 0.06])),
      },
      capacidad: { e1: { instalada: 1000, maxima: 3000 }, e2: { instalada: 1000, maxima: 3000 } },
      inversionCapacidad: {},
      deuda: { e1: 0, e2: 0 },
    }
  }

  test('el año 1 produce resultados coherentes y trazables', () => {
    const ctx = construirContexto()
    const marcas = [
      { marcaId: 'm1', equipoId: 'e1', nombre: 'Delizia Agua', precio: 21, publicidad: 300, produccion: 380, costoUnitario: 11.5, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8], inventario: 0, awareness: 0.3 },
      { marcaId: 'm2', equipoId: 'e1', nombre: 'Delizia Crema', precio: 32, publicidad: 380, produccion: 320, costoUnitario: 15.5, atributos: [6, 8, 10, 6, 6, 7], vendedores: [70, 15, 12], inventario: 0, awareness: 0.3 },
      { marcaId: 'm3', equipoId: 'e2', nombre: 'PIL Agua', precio: 20, publicidad: 280, produccion: 400, costoUnitario: 11.5, atributos: [7, 3, 1, 4, 5, 4], vendedores: [85, 12, 6], inventario: 0, awareness: 0.3 },
      { marcaId: 'm4', equipoId: 'e2', nombre: 'PIL Crema', precio: 31, publicidad: 350, produccion: 300, costoUnitario: 15.5, atributos: [6, 8, 10, 6, 6, 7], vendedores: [65, 14, 10], inventario: 0, awareness: 0.3 },
    ]
    const r = simularAnioBolivia(1, marcas, ctx)

    // no hay NaN ni negativos
    for (const e of r.equipos) {
      expect(Number.isFinite(e.ventas)).toBe(true)
      expect(e.ventas).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(e.finanzas.utilidadNeta)).toBe(true)
      expect(Number.isFinite(e.finanzas.iue)).toBe(true)
      expect(e.produccionAnio.utilizacionPct).toBeLessThanOrEqual(100.01)
    }
    for (const m of r.marcas) {
      expect(m.ventasMensual).toHaveLength(12)
      const sumaMensual = m.ventasMensual.reduce((s, v) => s + v, 0)
      expect(Math.abs(sumaMensual - m.ventas)).toBeLessThan(1) // redondeo
    }

    // las ventas de las empresas + Resto ≈ demanda total (doc §1.2)
    expect(r.ventasTotales).toBeGreaterThan(0)
    expect(r.ventasResto).toBeGreaterThan(0)
    expect(r.capturaEmpresas).toBeGreaterThan(0)
    expect(r.capturaEmpresas).toBeLessThan(100)

    // participaciones sobre el mercado de las empresas suman 100%
    const sumaParticipacion = r.equipos.reduce((s, e) => s + e.participacion, 0)
    expect(Math.abs(sumaParticipacion - 100)).toBeLessThan(1.5)

    // las ventas de cada equipo respetan la capacidad instalada (1000k L)
    for (const e of r.equipos) {
      expect(e.produccionAnio.capacidadUtilizada).toBeLessThanOrEqual(1000 + 1e-6)
    }

    // escala correcta: las ventas del mercado son del orden de la demanda (~15.900 kL),
    // no 1000 veces mayor ni menor (bug de escala litros/miles de litros)
    expect(r.demandaTotal).toBeGreaterThan(14000)
    expect(r.demandaTotal).toBeLessThan(17000)
    expect(r.capturaEmpresas).toBeGreaterThan(2)
    expect(r.capturaEmpresas).toBeLessThan(60)

    // detalle mensual: 12 meses
    expect(r.detalleMensual).toHaveLength(12)
    // trazabilidad de eventos y macro disponibles (doc §15, §18)
    expect(r.macroResumen.piAnual).toBeCloseTo(0.057, 9)
    expect(r.macroResumen.indicePreciosFin).toBeCloseTo(105.7, 1)
  })

  test('los eventos de demanda aumentan realmente las ventas del mercado (doc §0)', () => {
    const base = construirContexto()
    const marcas = [
      { marcaId: 'm1', equipoId: 'e1', nombre: 'Delizia Agua', precio: 21, publicidad: 300, produccion: 900, costoUnitario: 11.5, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8], inventario: 0, awareness: 0.5 },
      { marcaId: 'm3', equipoId: 'e2', nombre: 'PIL Agua', precio: 20, publicidad: 280, produccion: 900, costoUnitario: 11.5, atributos: [7, 3, 1, 4, 5, 4], vendedores: [85, 12, 6], inventario: 0, awareness: 0.5 },
    ]
    const sinEventos = simularAnioBolivia(1, marcas, base)
    const conEventos = simularAnioBolivia(1, marcas, {
      ...base,
      eventos: {
        demanda: Object.fromEntries(base.config.regiones.map((r) => [r.id, Array(12).fill(1.2)])),
        costo: Array(12).fill(1),
        logistica: {},
        demandaHoreca: Array(12).fill(1.2),
        trazabilidad: [],
      },
    })
    // demanda total +20-25% ⇒ las ventas del mercado crecen
    expect(conEventos.ventasTotales).toBeGreaterThan(sinEventos.ventasTotales)
    // y la demanda mensual calculada también (doc: los eventos modifican los cálculos)
    const demandaBase = sinEventos.detalleMensual.reduce((s, d) => s + d.demandaTotal, 0)
    const demandaCon = conEventos.detalleMensual.reduce((s, d) => s + d.demandaTotal, 0)
    expect(demandaCon).toBeGreaterThan(demandaBase * 1.15)
  })

  test('la producción se limita por la capacidad y el exceso se recorta', () => {
    const ctx = construirContexto()
    const marcas: MarcaSim[] = [
      { marcaId: 'm1', equipoId: 'e1', nombre: 'Delizia Agua', precio: 21, publicidad: 300, produccion: 2000, costoUnitario: 11.5, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8], inventario: 0, awareness: 0.3 },
    ]
    const r = simularAnioBolivia(1, marcas, ctx)
    expect(r.marcas[0].produccion).toBeLessThanOrEqual(1000)
    expect(r.equipos[0].produccionAnio.capacidadUtilizada).toBeLessThanOrEqual(1000)
  })
})

describe('7. Plan de eventos por año (corrección: 1-3 por año, categorías distintas)', () => {
  const CONFIG_AUTO = { probEconomicoAdverso: 0.2, probClimaticoAdverso: 0.15, probLogisticoAdverso: 0.2, eventosPorAnio: { min: 1, max: 3 } }

  test('el plan fija un evento para un año determinado y es determinista', () => {
    const catalogo = catalogoPrueba()
    const a1 = resolverEventosDesdePlan([{ evento: catalogo[0], origenPlan: 'DOCENTE' }], 1, 'semilla-a')
    const a1b = resolverEventosDesdePlan([{ evento: catalogo[0], origenPlan: 'DOCENTE' }], 1, 'semilla-a')
    expect(a1.map((e) => e.nombre)).toEqual(a1b.map((e) => e.nombre)) // determinista
    expect(a1).toHaveLength(1) // solo lo planificado ocurre (no el catálogo entero)
    expect(a1[0].nombre).toBe('Navidad')
    expect(a1[0].origen).toBe('PLAN_DOCENTE')
    expect(a1[0].meses).toEqual([12]) // Navidad cae en diciembre aunque se planifique para otro año
    expect(a1[0].traza).toContain('Año 1')
  })

  test('el autocompletado elige de 1 a 3 eventos, nunca dos de la misma categoría', () => {
    const catalogo = catalogoAmplio()
    for (let anio = 1; anio <= 30; anio++) {
      const elegidos = elegirEventosAuto(catalogo, anio, `semilla-${anio}`, CONFIG_AUTO)
      expect(elegidos.length).toBeGreaterThanOrEqual(1)
      expect(elegidos.length).toBeLessThanOrEqual(3)
      const categorias = elegidos.map((e) => e.categoria)
      expect(new Set(categorias).size).toBe(categorias.length) // categorías distintas
      const nombres = elegidos.map((e) => e.nombre)
      expect(new Set(nombres).size).toBe(nombres.length) // sin repetir evento
    }
    // determinista con la misma semilla
    const a = elegirEventosAuto(catalogo, 7, 'misma-semilla', CONFIG_AUTO)
    const b = elegirEventosAuto(catalogo, 7, 'misma-semilla', CONFIG_AUTO)
    expect(a.map((e) => e.nombre)).toEqual(b.map((e) => e.nombre))
    // respeta lo ya planificado (no repite nombres ni categorías)
    const conPrevios = elegirEventosAuto(catalogo, 9, 'misma-semilla', CONFIG_AUTO, ['Navidad'])
    expect(conPrevios.some((e) => e.nombre === 'Navidad')).toBe(false)
  })

  function catalogoPrueba(): EventoDef[] {
    return [
      { nombre: 'Navidad', categoria: 'FESTIVO', region: 'NACIONAL', regla: '12-25', mesesDuracion: 1, intensidad: 0.9, probabilidad: 1, efectoDemanda: 0.12, efectoCosto: 0, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'prueba' },
      { nombre: 'Escasez de combustible', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.6, probabilidad: 0.5, efectoDemanda: -0.04, efectoCosto: 0.15, efectoLogistica: 0.1, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
    ]
  }

  function catalogoAmplio(): EventoDef[] {
    return [
      { nombre: 'Navidad', categoria: 'FESTIVO', region: 'NACIONAL', regla: '12-25', mesesDuracion: 1, intensidad: 0.9, probabilidad: 1, efectoDemanda: 0.12, efectoCosto: 0, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'prueba' },
      { nombre: 'San Juan', categoria: 'FESTIVO', region: 'NACIONAL', regla: '06-23', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.06, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'prueba' },
      { nombre: 'Temporada de matrimonios', categoria: 'SOCIAL', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.5, probabilidad: 0.35, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
      { nombre: 'Escasez de combustible', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.6, probabilidad: 0.5, efectoDemanda: -0.04, efectoCosto: 0.15, efectoLogistica: 0.1, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
      { nombre: 'Crisis económica', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.8, probabilidad: 0.3, efectoDemanda: -0.12, efectoCosto: 0.1, efectoLogistica: 0.05, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
      { nombre: 'Bloqueo de carreteras', categoria: 'LOGISTICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.7, probabilidad: 0.4, efectoDemanda: -0.03, efectoCosto: 0.06, efectoLogistica: 0.18, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
      { nombre: 'Sequía', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.6, probabilidad: 0.3, efectoDemanda: -0.02, efectoCosto: 0.1, efectoLogistica: 0.03, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
      { nombre: 'Ola de calor', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.5, probabilidad: 0.4, efectoDemanda: 0.09, efectoCosto: 0.03, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'prueba' },
    ]
  }
})
