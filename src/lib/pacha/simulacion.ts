// ============================================================
// PACHA Simulador · Servicio de simulación (BOLIVIA)
// El "corazón" del sistema: empresas con comité de 5 gerentes,
// borradores por área, visto bueno del docente y procesamiento del
// periodo con el entorno nacional: eventos de Bolivia e inflación
// (doc §10, §15, §18). Configuración congelada por industria,
// compatible con simulaciones ya creadas.
// ============================================================

import { db } from '@/lib/db'
import { CARGOS, DESEMPENO, ESTUDIOS, ID_CONFIG, esCargoValido, probabilidadExito } from './catalogo'
import { crearConfigIndustria, validarConfiguracion, type ConfigIndustria } from './config-bolivia'
import { generarDatosEstudio, type MarcaContexto } from './estudios'
import { agruparEfectos, catalogoPorDefecto, elegirEventosAuto, resolverEventosDesdePlan, senalesInflacionDesdeEventos, type EntradaPlan, type EventoDef, type EventoPeriodo } from './eventos'
import { hashPassword } from './auth'
import { hash01 } from './hash'
import {
  calcularInflacion, deltaEscenario, indicePrecios, sortearEscenario, tasaComponente, tasaMensualEquivalente,
  type Escenario,
} from './inflacion'
import { reportesHistoria, simularAnioBolivia, type ContextoAnio, type MarcaSim } from './motor'
import { slugUsuario } from './slug'
import {
  PachaError,
  parseDecision,
  parseJson,
  type BorradorInvestigacion,
  type DecisionContenido,
} from './tipos'

const CLAVE_DEMO = '321'

interface PlantillaMarca {
  tipo: 'agua' | 'crema'
  precio: number
  publicidad: number
  produccion: number
  atributos: number[]
  vendedores: number[]
}

/** Cada empresa arranca con DOS marcas iniciales: una de helado de AGUA y una de CREMA
 * (doc §1). Escala Bs por litro (doc §4: costo de fabricación Bs 8 a 45 por litro). */
const MARCAS_INICIALES: PlantillaMarca[] = [
  { tipo: 'agua', precio: 21, publicidad: 300, produccion: 380, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8] },
  { tipo: 'crema', precio: 32, publicidad: 380, produccion: 320, atributos: [6, 8, 10, 6, 6, 7], vendedores: [70, 15, 12] },
]

const EQUIPO_COLORES_SAFE = ['#f472b6', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf', '#22d3ee', '#a3e635', '#f87171', '#38bdf8']

export interface IntegranteEntrada {
  usuario: string // nombre de usuario (login)
  nombre?: string // nombre visible (opcional; se usa el usuario)
}

export interface EmpresaEntrada {
  nombre: string
  integrantes: IntegranteEntrada[]
}

export interface CrearIndustriaOpts {
  periodos?: number
  empresas: EmpresaEntrada[]
}

/**
 * Crea una industria nueva:
 * · 2 a 10 empresas que compiten (por defecto, las 5 bolivianas: Delizia,
 *   PIL Andina, Frigo, Panda y Cabrera), cada una con 2 marcas (agua + crema)
 * · hasta 5 gerentes (alumnos) por empresa formando el Comité de Dirección de Marketing
 * · nº de periodos configurable por el docente (doc: Años 1 a 10)
 * · configuración de Bolivia congelada (configJson) y semilla de eventos
 * · historia del mercado: reportes de los 3 años anteriores al Año 1 (Años -2, -1 y 0)
 */
export async function crearIndustria(nombre: string, profesorId: string, opts: CrearIndustriaOpts) {
  if (!nombre.trim()) throw new PachaError('La industria necesita un nombre')
  const empresas = (opts.empresas ?? []).filter((e) => e.nombre?.trim())
  if (empresas.length < 2) throw new PachaError('Se necesitan al menos 2 empresas que compitan')
  if (empresas.length > 10) throw new PachaError('El máximo son 10 empresas')

  const validacion = validarConfiguracion()
  if (!validacion.ok) throw new PachaError(`Configuración de Bolivia inválida: ${validacion.errores.join('; ')}`)

  const periodos = Math.round(Math.min(20, Math.max(1, opts.periodos ?? 10)))

  const config = crearConfigIndustria(empresas.length)
  const industria = await db.industria.create({
    data: {
      nombre: nombre.trim(),
      profesorId,
      anioActual: 1,
      anioMaximo: periodos,
      configJson: JSON.stringify(config),
      semillaEventos: `pacha-${industriaSeed()}`,
    },
  })

  for (let i = 0; i < empresas.length; i++) {
    const emp = empresas[i]
    const nombreEquipo = emp.nombre.trim() || `Empresa ${i + 1}`
    const equipo = await db.equipo.create({
      data: {
        nombre: nombreEquipo,
        industriaId: industria.id,
        color: EQUIPO_COLORES_SAFE[i % EQUIPO_COLORES_SAFE.length],
        capacidadInstalada: config.produccion.capacidadInicialLitros / 1000, // miles de litros
        capacidadMaxima: config.produccion.capacidadMaximaLitros / 1000,
        coberturaJson: JSON.stringify(Object.fromEntries(config.regiones.map((r) => [r.id, 3]))),
        efectivo: 0,
        deuda: 0,
      },
    })

    // Dos marcas iniciales: una de AGUA y una de CREMA (doc §1)
    for (const plantilla of MARCAS_INICIALES) {
      await db.marca.create({
        data: {
          equipoId: equipo.id,
          nombre: `${nombreEquipo.split(' ')[0].slice(0, 10)} ${plantilla.tipo === 'agua' ? 'Agua' : 'Crema'}`,
          precio: plantilla.precio,
          publicidad: plantilla.publicidad,
          produccion: plantilla.produccion,
          costoUnitario: plantilla.tipo === 'agua' ? 11.5 : 15.5,
          atributos: JSON.stringify(plantilla.atributos),
          vendedores: JSON.stringify(plantilla.vendedores),
          inventario: 0,
          awareness: 0.05,
          anioLanzamiento: 0,
        },
      })
    }

    // Gerentes del comité: cada integrante toma uno de los 5 cargos (cíclico si sobran)
    for (let j = 0; j < emp.integrantes.length; j++) {
      const integ = emp.integrantes[j]
      const usuarioNombre = slugUsuario(integ.usuario || integ.nombre || '')
      if (!usuarioNombre) continue
      const usuario = await obtenerOCrearAlumno(usuarioNombre)
      const ocupado = await db.membresia.findFirst({ where: { usuarioId: usuario.id }, include: { equipo: true } })
      if (ocupado) {
        throw new PachaError(`${usuario.nombre} ya pertenece a la empresa «${ocupado.equipo.nombre}»`)
      }
      const cargo = CARGOS[j % CARGOS.length].id
      await db.membresia.create({
        data: { equipoId: equipo.id, usuarioId: usuario.id, cargo, puntos: DESEMPENO.puntosIniciales },
      })
    }
  }

  // Historia: los 3 años anteriores como reporte general del Año 0
  await generarHistoriaInicial(industria.id)

  // Corrección: cada simulación arranca con SU plan de eventos por año
  // (1–3 por año, categorías distintas), visible y editable por el docente
  // desde el primer momento. Sin esto, una simulación nueva aparece sin
  // eventos («los eventos no aparecen»).
  await autocompletarPlan(industria.id)

  return industria
}

/** Semilla pseudoaleatoria estable para la industria. */
function industriaSeed(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/** Encuentra o crea un usuario ALUMNO por nombre de usuario (clave demo 321). */
async function obtenerOCrearAlumno(usuarioNombre: string) {
  const existente = await db.usuario.findUnique({ where: { nombre: usuarioNombre } })
  if (existente) {
    if (existente.rol !== 'ALUMNO') throw new PachaError(`«${usuarioNombre}» ya existe y no es un alumno`)
    return existente
  }
  return db.usuario.create({
    data: { nombre: usuarioNombre, passwordHash: hashPassword(CLAVE_DEMO), rol: 'ALUMNO' },
  })
}

/** Config de la industria (creada con valores de Bolivia si falta — compatibilidad). */
export async function configDeIndustria(industriaId: string): Promise<{ config: ConfigIndustria; industria: Awaited<ReturnType<typeof db.industria.findUniqueOrThrow>> }> {
  const industria = await db.industria.findUniqueOrThrow({ where: { id: industriaId } })
  if (industria.configJson) {
    return { config: JSON.parse(industria.configJson) as ConfigIndustria, industria }
  }
  const nEmpresas = await db.equipo.count({ where: { industriaId } })
  const config = crearConfigIndustria(Math.max(2, nEmpresas))
  await db.industria.update({ where: { id: industriaId }, data: { configJson: JSON.stringify(config), semillaEventos: industria.semillaEventos ?? `pacha-${industriaSeed()}` } })
  return { config, industria }
}

/** Siembra el catálogo de eventos de Bolivia (idempotente). */
export async function sembrarCatalogoEventos() {
  const existentes = await db.eventoCatalogo.count()
  if (existentes > 0) return
  for (const ev of catalogoPorDefecto()) {
    await db.eventoCatalogo.create({
      data: {
        nombre: ev.nombre, categoria: ev.categoria, region: ev.region, regla: ev.regla,
        mesesDuracion: ev.mesesDuracion, intensidad: ev.intensidad, probabilidad: ev.probabilidad,
        efectoDemanda: ev.efectoDemanda, efectoCosto: ev.efectoCosto, efectoLogistica: ev.efectoLogistica,
        canal: ev.canal ?? null, activo: true, tipoDato: ev.tipoDato, fuente: ev.fuente,
      },
    })
  }
}

/** Mapea una fila del catálogo (DB) a la definición pura del evento. */
function defDeCatalogo(e: {
  nombre: string; categoria: string; region: string; regla: string; mesesDuracion: number
  intensidad: number; probabilidad: number; efectoDemanda: number; efectoCosto: number
  efectoLogistica: number; canal: string | null; tipoDato: string; fuente: string
}): EventoDef {
  return {
    nombre: e.nombre, categoria: e.categoria as EventoDef['categoria'], region: e.region, regla: e.regla,
    mesesDuracion: e.mesesDuracion, intensidad: e.intensidad, probabilidad: e.probabilidad,
    efectoDemanda: e.efectoDemanda, efectoCosto: e.efectoCosto, efectoLogistica: e.efectoLogistica,
    canal: e.canal ?? undefined,
    signo: e.efectoDemanda >= 0 && e.efectoCosto >= 0 ? 'POSITIVO' : 'NEGATIVO',
    tipoDato: e.tipoDato as 'oficial' | 'hipotesis', fuente: e.fuente,
  }
}

// ============================================================
// PLAN DE EVENTOS POR AÑO (corrección del docente)
// · Los eventos ocurren dentro de las simulaciones de los estudiantes
// · Ocurren por años: el docente fija un evento para un año determinado
// · De 1 a 3 eventos por año, sin repetir categoría en el mismo año
// ============================================================

export interface PlanEventoVista {
  planId: string
  catalogoId: string
  nombre: string
  categoria: string
  region: string
  meses: number[]
  intensidad: number
  efectoDemanda: number
  efectoCosto: number
  efectoLogistica: number
  signo: string
  origen: string // DOCENTE | AUTO
}

export interface PlanAnioVista {
  anio: number
  ejecutado: boolean
  eventos: PlanEventoVista[]
}

export interface PlanEventosVista {
  industriaId: string
  anioActual: number
  anioMaximo: number
  reglas: { eventosPorAnio: string; categoriasUnicasPorAnio: boolean; maximo: number; minimo: number }
  anios: PlanAnioVista[]
  catalogo: { id: string; nombre: string; categoria: string; region: string; signo: string; activo: boolean }[]
}

function configEventosDe(config: ConfigIndustria) {
  const ev = config.eventos as Partial<ConfigIndustria['eventos']> & typeof config.eventos
  return {
    eventosPorAnio: ev.eventosPorAnio ?? { min: 1, max: 3 }, // configs antiguas sin el campo
    probEconomicoAdverso: config.eventos.probEconomicoAdverso.valor,
    probClimaticoAdverso: config.eventos.probClimaticoAdverso.valor,
    probLogisticoAdverso: config.eventos.probLogisticoAdverso.valor,
  }
}

/** Un año del plan solo es editable si su periodo aún no se ejecutó. */
async function validarAnioEditable(industriaId: string, anio: number, anioActual: number) {
  if (anio < anioActual) throw new PachaError(`El Año ${anio} ya fue ejecutado; el plan de ese año es inmutable`)
  const macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio } } })
  if (macro?.ejecutado) throw new PachaError('El periodo ya fue ejecutado y es inmutable')
}

/** Borra los eventos resueltos de un periodo no ejecutado para regenerarlos desde el plan. */
async function invalidarEventosPeriodo(industriaId: string, anio: number) {
  const macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio } } })
  if (macro?.ejecutado) return
  await db.eventoPeriodo.deleteMany({ where: { industriaId, anio } })
}

/**
 * Completa con eventos automáticos (1 a 3, de categorías distintas) un año sin
 * planificación. Crea filas de EventoPlan con origen AUTO para que el docente
 * las vea y ajuste. Determinista por la semilla de la industria.
 */
async function completarPlanAnio(industriaId: string, anio: number, semillaBase: string): Promise<number> {
  const existentes = await db.eventoPlan.findMany({ where: { industriaId, anio }, include: { evento: true } })
  if (existentes.length > 0) return 0
  const { config } = await configDeIndustria(industriaId)
  const catalogo = await db.eventoCatalogo.findMany({ where: { activo: true } })
  if (catalogo.length === 0) return 0
  const elegidos = elegirEventosAuto(
    catalogo.map(defDeCatalogo),
    anio,
    semillaBase,
    configEventosDe(config),
    existentes.map((p) => p.evento.nombre)
  )
  const porNombre = new Map(catalogo.map((e) => [e.nombre, e]))
  let creados = 0
  for (const ev of elegidos) {
    const fila = porNombre.get(ev.nombre)
    if (!fila) continue
    try {
      await db.eventoPlan.create({ data: { industriaId, anio, catalogoId: fila.id, origen: 'AUTO' } })
      creados++
    } catch {
      // carrera benigna: ya existe esa fila (única por industria+año+evento)
    }
  }
  return creados
}

/** Vista del plan de eventos de una simulación: años 1..N con sus eventos. */
export async function planDeEventos(industriaId: string): Promise<PlanEventosVista> {
  await sembrarCatalogoEventos()
  const industria = await db.industria.findUnique({ where: { id: industriaId } })
  if (!industria) throw new PachaError('Industria no encontrada', 404)
  const semillaBase = industria.semillaEventos ?? 'pacha'
  const plan = await db.eventoPlan.findMany({ where: { industriaId }, include: { evento: true }, orderBy: [{ anio: 'asc' }, { createdAt: 'asc' }] })
  const macros = await db.macroPeriodo.findMany({ where: { industriaId } })
  const ejecutadoPorAnio = new Map(macros.map((m) => [m.anio, m.ejecutado]))
  const catalogo = await db.eventoCatalogo.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] })

  const anios: PlanAnioVista[] = []
  for (let anio = 1; anio <= industria.anioMaximo; anio++) {
    const filas = plan.filter((p) => p.anio === anio)
    const entradas: EntradaPlan[] = filas.map((p) => ({ evento: defDeCatalogo(p.evento), origenPlan: p.origen === 'AUTO' ? 'AUTO' : 'DOCENTE' }))
    const resueltos = resolverEventosDesdePlan(entradas, anio, `${semillaBase}|${anio}`)
    const mesesPorNombre = new Map(resueltos.map((r) => [r.nombre, r.meses]))
    anios.push({
      anio,
      ejecutado: anio < industria.anioActual || ejecutadoPorAnio.get(anio) === true,
      eventos: filas.map((p) => {
        const def = defDeCatalogo(p.evento)
        return {
          planId: p.id, catalogoId: p.evento.id, nombre: p.evento.nombre, categoria: p.evento.categoria,
          region: p.evento.region, meses: mesesPorNombre.get(p.evento.nombre) ?? [], intensidad: p.evento.intensidad,
          efectoDemanda: p.evento.efectoDemanda, efectoCosto: p.evento.efectoCosto, efectoLogistica: p.evento.efectoLogistica,
          signo: def.signo, origen: p.origen,
        }
      }),
    })
  }

  return {
    industriaId,
    anioActual: industria.anioActual,
    anioMaximo: industria.anioMaximo,
    reglas: {
      eventosPorAnio: 'De 1 a 3 eventos por año, sin repetir categoría en el mismo año',
      categoriasUnicasPorAnio: true,
      maximo: 3,
      minimo: 1,
    },
    anios,
    catalogo: catalogo.map((e) => ({
      id: e.id, nombre: e.nombre, categoria: e.categoria, region: e.region,
      signo: e.efectoDemanda >= 0 && e.efectoCosto >= 0 ? 'POSITIVO' : 'NEGATIVO', activo: e.activo,
    })),
  }
}

/** El docente fija un evento del catálogo para un año determinado de la simulación. */
export async function asignarEventoPlan(industriaId: string, anio: number, catalogoId: string) {
  await sembrarCatalogoEventos()
  const industria = await db.industria.findUnique({ where: { id: industriaId } })
  if (!industria) throw new PachaError('Industria no encontrada', 404)
  if (!Number.isInteger(anio) || anio < 1 || anio > industria.anioMaximo) {
    throw new PachaError(`El año debe estar entre 1 y ${industria.anioMaximo}`)
  }
  await validarAnioEditable(industriaId, anio, industria.anioActual)
  const evento = await db.eventoCatalogo.findUnique({ where: { id: catalogoId } })
  if (!evento || !evento.activo) throw new PachaError('Evento del catálogo no encontrado o inactivo', 404)

  const existentes = await db.eventoPlan.findMany({ where: { industriaId, anio }, include: { evento: true } })
  if (existentes.length >= 3) throw new PachaError(`El Año ${anio} ya tiene 3 eventos (máximo permitido por año)`)
  const mismaCategoria = existentes.find((p) => p.evento.categoria === evento.categoria)
  if (mismaCategoria) {
    throw new PachaError(`El Año ${anio} ya tiene un evento de categoría ${evento.categoria} (${mismaCategoria.evento.nombre}); los eventos de un año deben ser de categorías distintas`)
  }
  if (existentes.some((p) => p.evento.nombre === evento.nombre)) {
    throw new PachaError(`"${evento.nombre}" ya está planificado para el Año ${anio}`)
  }

  await db.eventoPlan.create({ data: { industriaId, anio, catalogoId, origen: 'DOCENTE' } })
  await invalidarEventosPeriodo(industriaId, anio)
  return { ok: true }
}

/** Quita una entrada del plan (si su año aún no se ejecutó). */
export async function quitarEventoPlan(industriaId: string, planId: string) {
  const plan = await db.eventoPlan.findUnique({ where: { id: planId }, include: { industria: true } })
  if (!plan || plan.industriaId !== industriaId) throw new PachaError('Planificación no encontrada', 404)
  await validarAnioEditable(industriaId, plan.anio, plan.industria.anioActual)
  await db.eventoPlan.delete({ where: { id: planId } })
  await invalidarEventosPeriodo(industriaId, plan.anio)
  return { ok: true }
}

/**
 * Autocompleta los años aún no ejecutados que no tienen eventos: 1 a 3
 * eventos por año, siempre de categorías distintas. Devuelve los años tocados.
 */
export async function autocompletarPlan(industriaId: string) {
  const industria = await db.industria.findUnique({ where: { id: industriaId } })
  if (!industria) throw new PachaError('Industria no encontrada', 404)
  const semillaBase = industria.semillaEventos ?? 'pacha'
  const anios: number[] = []
  let eventosCreados = 0
  for (let anio = Math.max(1, industria.anioActual); anio <= industria.anioMaximo; anio++) {
    const macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio } } })
    if (macro?.ejecutado) continue
    const creados = await completarPlanAnio(industriaId, anio, `${semillaBase}|${anio}`)
    if (creados > 0) {
      anios.push(anio)
      eventosCreados += creados
      await invalidarEventosPeriodo(industriaId, anio)
    }
  }
  return { ok: true, eventosCreados, anios }
}

/** Genera y persiste los reportes históricos de los 3 años anteriores (Años -2, -1, 0). */
async function generarHistoriaInicial(industriaId: string) {
  const { config } = await configDeIndustria(industriaId)
  const equipos = await db.equipo.findMany({ where: { industriaId }, include: { marcas: true } })
  const todas = equipos.flatMap((e) =>
    e.marcas.map((m) => ({
      marcaId: m.id,
      equipoId: e.id,
      nombre: m.nombre,
      precio: m.precio,
      publicidad: m.publicidad,
      costoUnitario: m.costoUnitario,
      vendedores: parseJson<number[]>(m.vendedores, [10, 5, 3]),
    }))
  )
  const historia = reportesHistoria(todas, [-2, -1, 0], config)

  for (const anioHistoria of historia) {
    for (const r of anioHistoria.equipos) {
      await guardarReporte(r.equipoId, anioHistoria.anio, r, anioHistoria.marcas.filter((m) => m.equipoId === r.equipoId), false)
    }
    // El awareness de las marcas evoluciona con la publicidad de la historia
    if (anioHistoria.anio === 0) {
      for (const m of anioHistoria.marcas) {
        await db.marca.update({ where: { id: m.marcaId }, data: { awareness: m.awarenessNueva } })
      }
    }
  }
}

async function guardarReporte(
  equipoId: string,
  anio: number,
  agregado: { ventas: number; ingresos: number; costos: number; publicidad: number; fuerzaVentas: number; contribucion: number; participacion: number },
  marcasRep: {
    marcaId: string
    nombre: string
    ventas: number
    produccion: number
    inventarioFinal: number
    ingresos: number
    costos: number
    contribucion: number
    porCanal: unknown
    porSegmento: unknown
  }[],
  sinDecision: boolean,
  investigacionMercado = 0,
  detalleJson?: string
) {
  await db.reporte.deleteMany({ where: { equipoId, anio } })
  const reporte = await db.reporte.create({
    data: {
      equipoId,
      anio,
      ventas: agregado.ventas,
      ingresos: agregado.ingresos,
      costos: agregado.costos,
      publicidad: agregado.publicidad,
      fuerzaVentas: agregado.fuerzaVentas,
      contribucion: agregado.contribucion,
      participacion: agregado.participacion,
      sinDecision,
      investigacionMercado,
      detalleJson: detalleJson ?? null,
    },
  })
  for (const m of marcasRep) {
    await db.reporteMarca.create({
      data: {
        reporteId: reporte.id,
        marcaNombre: m.nombre,
        ventas: m.ventas,
        produccion: m.produccion,
        inventario: m.inventarioFinal,
        ingresos: m.ingresos,
        costos: m.costos,
        contribucion: m.contribucion,
        participacion: agregado.ventas > 0 ? Math.round((m.ventas / agregado.ventas) * 1000) / 10 : 0,
        porCanal: JSON.stringify(m.porCanal),
        porSegmento: JSON.stringify(m.porSegmento),
      },
    })
  }
}


/** Límites de inflación como números planos (los Parámetros llevan metadatos). */
function limitesDe(config: ConfigIndustria) {
  return {
    piso: config.inflacion.piso.valor,
    techo: config.inflacion.techo.valor,
    limiteFactores: config.inflacion.limiteFactores.valor,
    escenarios: config.inflacion.escenarios,
    factoresMax: config.inflacion.factoresMax,
  }
}

// ============================================================
// PREPARACIÓN DEL PERIODO (doc §15 y §18.10): antes de ejecutar
// quedan fijados los eventos y la inflación (escenario sorteado con
// semilla registrada o fijado por el docente), como vista previa.
// ============================================================

export interface VistaPreviaPeriodo {
  anio: number
  eventos: {
    id: string
    nombre: string
    categoria: string
    region: string
    meses: number[]
    efectoDemanda: number
    efectoCosto: number
    efectoLogistica: number
    canal: string | null
    origen: string
    activo: boolean
    traza: string
  }[]
  macro: {
    anio: number
    escenario: string
    escenarioOrigen: string
    deltaEscenario: number
    inflacionAnual: number
    factores: { factor: string; senal: number; aporte: number }[]
    aporteFactores: number
    tipoCambioInicio: number
    tipoCambioFinal: number
    tasaInteres: number
    indicePreciosInicio: number
    indicePreciosFin: number
    inflacionMensual: number[]
    tasasComponentes: Record<string, number>
    ejecutado: boolean
  }
}

/** Índice de precios acumulado hasta el año anterior (base 100 en el Año 0). */
async function indicePreciosHasta(industriaId: string, anio: number): Promise<number> {
  const macros = await db.macroPeriodo.findMany({ where: { industriaId, anio: { lt: anio } }, orderBy: { anio: 'asc' } })
  let idx = 100
  for (const m of macros) idx = indicePrecios(idx, m.inflacionAnual)
  return idx
}

/**
 * Prepara (o devuelve) la vista previa del periodo actual: eventos resueltos
 * (calendario + extraordinarios con semilla) y π_t con su auditoría de factores.
 * El docente puede fijar el escenario antes de ejecutar; una vez ejecutado el
 * periodo, los datos son inmutables (doc §18.12 regla 8).
 */
export async function prepararPeriodo(industriaId: string, escenarioFijado?: Escenario): Promise<VistaPreviaPeriodo> {
  await sembrarCatalogoEventos()
  const { config, industria } = await configDeIndustria(industriaId)
  const anio = industria.anioActual

  let macro = await db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio } } })
  const eventosExistentes = await db.eventoPeriodo.findMany({ where: { industriaId, anio }, orderBy: { nombre: 'asc' } })

  if (macro?.ejecutado) {
    // periodo ya ejecutado: devolver lo congelado
    return construirVistaPrevia(macro, eventosExistentes, anio, await indicePreciosHasta(industriaId, anio))
  }

  const semilla = `${industria.semillaEventos ?? 'pacha'}|${anio}`

  // 1) Eventos del periodo: PLAN por año de esta simulación (corrección: 1-3
  //    eventos por año, sin repetir categoría; el docente fija el año de cada
  //    evento). Un año sin plan se completa automáticamente con semilla registrada.
  if (eventosExistentes.length === 0 || escenarioFijado) {
    if (eventosExistentes.length === 0) {
      await completarPlanAnio(industriaId, anio, semilla)
      const plan = await db.eventoPlan.findMany({ where: { industriaId, anio }, include: { evento: true }, orderBy: { createdAt: 'asc' } })
      const entradas: EntradaPlan[] = plan.map((p) => ({ evento: defDeCatalogo(p.evento), origenPlan: p.origen === 'AUTO' ? 'AUTO' : 'DOCENTE' }))
      const eventos = resolverEventosDesdePlan(entradas, anio, semilla)
      await db.eventoPeriodo.deleteMany({ where: { industriaId, anio } })
      for (const ev of eventos) {
        await db.eventoPeriodo.create({
          data: {
            industriaId, anio, nombre: ev.nombre, categoria: ev.categoria, region: ev.region,
            mesesJson: JSON.stringify(ev.meses), efectoDemanda: ev.efectoDemanda, efectoCosto: ev.efectoCosto,
            efectoLogistica: ev.efectoLogistica, canal: ev.canal ?? null, origen: ev.origen,
            activo: true, trazabilidadJson: ev.traza,
          },
        })
      }
    }

    // 2) Inflación del periodo: π_t = π_{t-1} + Δ_esc + Σ s_k·a_k (doc §18.4)
    const eventosDb = await db.eventoPeriodo.findMany({ where: { industriaId, anio, activo: true } })
    const eventosActivos: EventoPeriodo[] = eventosDb.map((e) => ({
      nombre: e.nombre, categoria: e.categoria as EventoPeriodo['categoria'], region: e.region,
      meses: parseJson<number[]>(e.mesesJson, []), efectoDemanda: e.efectoDemanda, efectoCosto: e.efectoCosto,
      efectoLogistica: e.efectoLogistica, canal: e.canal ?? undefined, origen: e.origen as EventoPeriodo['origen'],
      traza: e.trazabilidadJson,
    }))
    const senales = senalesInflacionDesdeEventos(eventosActivos, config.inflacion.traspasoEventos.valor)
    const previa = anio <= 1 ? config.macro.inflacionAnio0 : (await macroAnioAnterior(industriaId, anio))?.inflacionAnual ?? config.macro.inflacionAnio0

    const escenario: Escenario = escenarioFijado ?? (macro?.escenarioOrigen === 'FIJADO_DOCENTE' ? macro.escenario as Escenario : sortearEscenario(`${semilla}|esc`, config.inflacion.escenarios))
    const delta = escenarioFijado || !macro ? deltaEscenario(`${semilla}|esc`, escenario, config.inflacion.escenarios) : macro.deltaEscenario
    const crisis = eventosActivos.some((e) => e.nombre === 'Crisis económica')
    const resultado = calcularInflacion(previa, delta, senales, limitesDe(config), crisis)

    // tipo de cambio: régimen flexible con depreciación por escenario (doc §9.3)
    const tcAnterior = anio <= 1 ? config.macro.tipoCambioAnio0 : (await macroAnioAnterior(industriaId, anio))?.tipoCambioFinal ?? config.macro.tipoCambioAnio0
    const depreciacion = escenario === 'DESFAVORABLE' ? 0.08 : escenario === 'ESTABLE' ? 0.05 : 0.02
    const tcFinal = tcAnterior * (1 + depreciacion)

    // tasas por componente de costo (doc §18.7)
    const tasasComponentes: Record<string, number> = {}
    for (const c of config.costos) {
      const fDiferencial = senales.find((s) => (c.id === 'leche' && s.factor === 'leche') || (c.id === 'envases' && s.factor === 'envases'))?.senal ?? 0
      tasasComponentes[c.id] = tasaComponente(c.importado, c.beta, resultado.pi, fDiferencial * (config.inflacion.factoresMax[c.id === 'leche' ? 'leche' : 'envases'] ?? 0.005), depreciacion)
    }

    const datos = {
      escenario,
      escenarioOrigen: escenarioFijado ? 'FIJADO_DOCENTE' : 'SORTEADO',
      semilla,
      deltaEscenario: delta,
      inflacionAnual: resultado.pi,
      factoresJson: JSON.stringify(resultado.factoresAplicados),
      inflacionMensualJson: JSON.stringify(Array(12).fill(tasaMensualEquivalente(resultado.pi))),
      indicePreciosInicio: await indicePreciosHasta(industriaId, anio),
      indicePreciosFin: indicePrecios(await indicePreciosHasta(industriaId, anio), resultado.pi),
      tipoCambioInicio: tcAnterior,
      tipoCambioFinal: tcFinal,
      tasaInteres: config.finanzas.tasaInteres,
      ejecutado: false,
    }

    if (macro) {
      macro = await db.macroPeriodo.update({ where: { id: macro.id }, data: datos })
    } else {
      macro = await db.macroPeriodo.create({ data: { industriaId, anio, ...datos } })
    }
  }

  const eventosFinales = await db.eventoPeriodo.findMany({ where: { industriaId, anio }, orderBy: { nombre: 'asc' } })
  return construirVistaPrevia(macro!, eventosFinales, anio, macro!.indicePreciosInicio)
}

async function macroAnioAnterior(industriaId: string, anio: number) {
  if (anio <= 1) return null
  return db.macroPeriodo.findUnique({ where: { industriaId_anio: { industriaId, anio: anio - 1 } } })
}

function construirVistaPrevia(
  macro: { anio: number; escenario: string; escenarioOrigen: string; deltaEscenario: number; inflacionAnual: number; factoresJson: string; inflacionMensualJson: string; indicePreciosInicio: number; indicePreciosFin: number; tipoCambioInicio: number; tipoCambioFinal: number; tasaInteres: number; ejecutado: boolean },
  eventos: { id: string; nombre: string; categoria: string; region: string; mesesJson: string; efectoDemanda: number; efectoCosto: number; efectoLogistica: number; canal: string | null; origen: string; activo: boolean; trazabilidadJson: string }[],
  anio: number,
  _indiceInicio: number
): VistaPreviaPeriodo {
  return {
    anio,
    eventos: eventos.map((e) => ({
      id: e.id, nombre: e.nombre, categoria: e.categoria, region: e.region,
      meses: parseJson<number[]>(e.mesesJson, []), efectoDemanda: e.efectoDemanda, efectoCosto: e.efectoCosto,
      efectoLogistica: e.efectoLogistica, canal: e.canal, origen: e.origen, activo: e.activo, traza: e.trazabilidadJson,
    })),
    macro: {
      anio: macro.anio, escenario: macro.escenario, escenarioOrigen: macro.escenarioOrigen,
      deltaEscenario: macro.deltaEscenario, inflacionAnual: macro.inflacionAnual,
      factores: parseJson<{ factor: string; senal: number; aporte: number }[]>(macro.factoresJson, []),
      aporteFactores: parseJson<{ factor: string; senal: number; aporte: number }[]>(macro.factoresJson, []).reduce((s, f) => s + f.aporte, 0),
      tipoCambioInicio: macro.tipoCambioInicio, tipoCambioFinal: macro.tipoCambioFinal,
      tasaInteres: macro.tasaInteres,
      indicePreciosInicio: macro.indicePreciosInicio, indicePreciosFin: macro.indicePreciosFin,
      inflacionMensual: parseJson<number[]>(macro.inflacionMensualJson, []),
      tasasComponentes: {},
      ejecutado: macro.ejecutado,
    },
  }
}

/**
 * Corre la simulación del año actual (con el visto bueno del docente):
 * 1) prepara el entorno del periodo (eventos + inflación, congelados al ejecutar)
 * 2) lee decisiones APROBADAS · 3) aplica I+D aprobado · 4) ejecuta el motor mensual ·
 * 5) guarda reportes con detalle · 6) actualiza marcas, capacidad y deuda ·
 * 7) genera estudios · 8) evalúa I+D · 9) ajusta puntos de desempeño · 10) avanza el año.
 * Las empresas sin visto bueno juegan con sus valores vigentes (predeterminados).
 */
export async function procesarRonda(industriaId: string) {
  const industriaPrev = await db.industria.findUnique({
    where: { id: industriaId },
    include: { equipos: { include: { marcas: true, membresias: true } } },
  })
  if (!industriaPrev) throw new PachaError('Industria no encontrada', 404)
  if (industriaPrev.estado !== 'ACTIVA') throw new PachaError('La simulación ya finalizó')
  if (industriaPrev.anioActual > industriaPrev.anioMaximo) throw new PachaError('Ya se alcanzó el año máximo')

  const anio = industriaPrev.anioActual
  const equipoIds = industriaPrev.equipos.map((e) => e.id)

  // 0) Entorno del periodo: eventos e inflación quedan fijados y congelados (doc §15, §18.10)
  await prepararPeriodo(industriaId)
  const { config } = await configDeIndustria(industriaId)
  const industria = industriaPrev
  const macroDb = await db.macroPeriodo.findUniqueOrThrow({ where: { industriaId_anio: { industriaId, anio } } })
  const eventosDb = await db.eventoPeriodo.findMany({ where: { industriaId, anio, activo: true } })
  const eventosActivos: EventoPeriodo[] = eventosDb.map((e) => ({
    nombre: e.nombre, categoria: e.categoria as EventoPeriodo['categoria'], region: e.region,
    meses: parseJson<number[]>(e.mesesJson, []), efectoDemanda: e.efectoDemanda, efectoCosto: e.efectoCosto,
    efectoLogistica: e.efectoLogistica, canal: e.canal ?? undefined, origen: e.origen as EventoPeriodo['origen'],
    traza: e.trazabilidadJson,
  }))
  const efectos = agruparEfectos(eventosActivos)
  const senales = senalesInflacionDesdeEventos(eventosActivos, config.inflacion.traspasoEventos.valor)

  const tasasComponentes: Record<string, number> = {}
  for (const c of config.costos) {
    const fDiferencial = senales.find((s) => (c.id === 'leche' && s.factor === 'leche') || (c.id === 'envases' && s.factor === 'envases'))?.senal ?? 0
    tasasComponentes[c.id] = tasaComponente(c.importado, c.beta, macroDb.inflacionAnual, fDiferencial * (config.inflacion.factoresMax[c.id === 'leche' ? 'leche' : 'envases'] ?? 0.005), macroDb.tipoCambioFinal / macroDb.tipoCambioInicio - 1)
  }

  // 1) Decisiones con visto bueno del docente
  const decisiones = await db.decision.findMany({
    where: { equipoId: { in: equipoIds }, anio, estado: 'APROBADA' },
  })
  const decisionPorEquipo = new Map(decisiones.map((d) => [d.equipoId, d]))
  const equiposSinVistoBueno = industria.equipos.filter((e) => !decisionPorEquipo.has(e.id))

  // 2) Aplicar decisiones aprobadas a las marcas (y proyectos I+D de lanzamiento)
  for (const equipo of industria.equipos) {
    const dec = decisionPorEquipo.get(equipo.id)
    if (!dec) continue
    const contenido = parseDecision(dec.contenido)

    for (const dm of contenido.marcas) {
      const marca = await db.marca.findFirst({ where: { id: dm.marcaId, equipoId: equipo.id } })
      if (!marca) continue
      await db.marca.update({
        where: { id: marca.id },
        data: {
          precio: clampNum(dm.precio, 1, 80),
          publicidad: clampNum(dm.publicidad, 0, 5000),
          produccion: clampNum(dm.produccion, 0, 4000),
          vendedores: JSON.stringify(dm.vendedores.map((v) => clampNum(v, 0, 2000))),
        },
      })
    }

    for (const dn of contenido.nuevas) {
      const proyecto = await db.proyectoID.findFirst({
        where: { id: dn.proyectoId, equipoId: equipo.id, estado: 'APROBADO' },
      })
      if (!proyecto) continue
      const atributos = parseJson<number[]>(proyecto.atributos, [5, 5, 5, 5, 5, 5])
      await db.marca.create({
        data: {
          equipoId: equipo.id,
          nombre: dn.nombre.slice(0, 24),
          precio: clampNum(dn.precio, 1, 80),
          publicidad: clampNum(dn.publicidad, 0, 5000),
          produccion: clampNum(dn.produccion, 0, 4000),
          costoUnitario: 15,
          atributos: JSON.stringify(atributos),
          vendedores: JSON.stringify(dn.vendedores.map((v) => clampNum(v, 0, 2000))),
          inventario: 0,
          awareness: 0.05,
          anioLanzamiento: anio,
        },
      })
      await db.proyectoID.update({ where: { id: proyecto.id }, data: { estado: 'APLICADO' } })
    }
  }

  // 3) Ejecutar el motor mensual con todas las marcas activas (valores vigentes)
  const marcasDb = await db.marca.findMany({ where: { equipoId: { in: equipoIds }, activa: true } })
  const marcasSim: MarcaSim[] = marcasDb.map((m) => ({
    marcaId: m.id,
    equipoId: m.equipoId,
    nombre: m.nombre,
    precio: m.precio,
    publicidad: m.publicidad,
    produccion: m.produccion,
    costoUnitario: m.costoUnitario,
    atributos: parseJson<number[]>(m.atributos, [5, 5, 5, 5, 5, 5]),
    vendedores: parseJson<number[]>(m.vendedores, [10, 5, 3]),
    inventario: m.inventario,
    awareness: m.awareness,
  }))

  const borradoresProd = await db.borradorArea.findMany({ where: { equipoId: { in: equipoIds }, anio, cargo: 'produccion', enviado: true } })
  const inversionPorEquipo: Record<string, number> = {}
  for (const b of borradoresProd) {
    const contenido = parseJson<{ inversionCapacidad?: number }>(b.contenido, {})
    if (contenido.inversionCapacidad && contenido.inversionCapacidad > 0) {
      inversionPorEquipo[b.equipoId] = clampNum(contenido.inversionCapacidad, 0, 3000)
    }
  }

  const ctx: ContextoAnio = {
    config,
    eventos: efectos,
    macro: {
      piAnual: macroDb.inflacionAnual,
      tasaMensual: tasaMensualEquivalente(macroDb.inflacionAnual),
      indicePreciosInicio: macroDb.indicePreciosInicio,
      tipoCambioInicio: macroDb.tipoCambioInicio,
      tipoCambioFinal: macroDb.tipoCambioFinal,
      tasaInteres: macroDb.tasaInteres,
      tasasComponentes,
    },
    capacidad: Object.fromEntries(industria.equipos.map((e) => [e.id, { instalada: e.capacidadInstalada, maxima: e.capacidadMaxima }])),
    inversionCapacidad: inversionPorEquipo,
    deuda: Object.fromEntries(industria.equipos.map((e) => [e.id, e.deuda])),
  }

  const resultado = simularAnioBolivia(anio, marcasSim, ctx)
  const resultadoPorMarca = new Map(resultado.marcas.map((r) => [r.marcaId, r]))
  const resultadoPorEquipo = new Map(resultado.equipos.map((r) => [r.equipoId, r]))

  // 4) Guardar reportes con detalle mensual/regional/financiero (incluye sin visto bueno)
  for (const equipo of industria.equipos) {
    const agg = resultadoPorEquipo.get(equipo.id) ?? {
      ventas: 0, ingresos: 0, costos: 0, publicidad: 0, fuerzaVentas: 0, contribucion: 0, participacion: 0,
    }
    const gastosEstudios = await db.compraEstudio.aggregate({
      where: { equipoId: equipo.id, anio },
      _sum: { costo: true },
    })
    const marcasRep = marcasDb
      .filter((m) => m.equipoId === equipo.id)
      .map((m) => resultadoPorMarca.get(m.id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ ...r, nombre: r.nombre }))
    const detalle = {
      participacionTotal: agg.participacion,
      mercado: { demandaTotal: resultado.demandaTotal, ventasEmpresas: resultado.ventasEmpresas, ventasResto: resultado.ventasResto, capturaEmpresas: resultado.capturaEmpresas },
      detalleMensual: resultado.detalleMensual,
      porRegion: resultadoPorEquipo.get(equipo.id)?.porRegion ?? [],
      finanzas: resultadoPorEquipo.get(equipo.id)?.finanzas ?? null,
      produccionAnio: resultadoPorEquipo.get(equipo.id)?.produccionAnio ?? null,
      marcasMensual: Object.fromEntries(marcasRep.map((r) => [r.nombre, r.ventasMensual])),
      inflacion: {
        anio, escenario: macroDb.escenario, pi: macroDb.inflacionAnual,
        factores: parseJson<{ factor: string; senal: number; aporte: number }[]>(macroDb.factoresJson, []),
        indicePreciosFin: macroDb.indicePreciosFin, tipoCambioFinal: macroDb.tipoCambioFinal,
        tasasComponentes,
      },
      eventos: resultado.eventosTrazabilidad,
    }
    await guardarReporte(
      equipo.id,
      anio,
      agg,
      marcasRep,
      !decisionPorEquipo.has(equipo.id),
      round1Safe(gastosEstudios._sum.costo ?? 0),
      JSON.stringify(detalle)
    )
  }

  // 5) Actualizar estado de las marcas (awareness, inventario, costo indexado por π_c)
  for (const r of resultado.marcas) {
    const marca = marcasDb.find((m) => m.id === r.marcaId)
    const atributos = marca ? parseJson<number[]>(marca.atributos, [5, 5, 5, 5, 5, 5]) : [5, 5, 5, 5, 5, 5]
    const insumosBase0 = config.costos.reduce((s, c) => s + c.peso * c.precioBase, 0)
    const inflacionCostos = config.costos.reduce((s, c) => s + c.peso * (1 + (tasasComponentes[c.id] ?? 0)), 0)
    const promAtributos = atributos.reduce((s, a) => s + a, 0) / 6
    const costoNuevo = Math.round((insumosBase0 * inflacionCostos + 4 + 1.7 * promAtributos) * 100) / 100
    await db.marca.update({
      where: { id: r.marcaId },
      data: { awareness: r.awarenessNueva, inventario: r.inventarioFinal, costoUnitario: costoNuevo },
    })
  }

  // 5b) Actualizar capacidad instalada (inversiones) y deuda de cada equipo
  for (const equipo of industria.equipos) {
    const fin = resultadoPorEquipo.get(equipo.id)
    if (!fin) continue
    const nuevaCapacidad = Math.min(
      equipo.capacidadMaxima,
      equipo.capacidadInstalada + (fin.produccionAnio.inversionCapacidad || 0)
    )
    await db.equipo.update({
      where: { id: equipo.id },
      data: { capacidadInstalada: nuevaCapacidad, deuda: fin.finanzas.deudaFinal },
    })
  }

  // 5c) Congelar el periodo macro como ejecutado (doc §18.12 regla 8)
  await db.macroPeriodo.update({
    where: { industriaId_anio: { industriaId, anio } },
    data: { ejecutado: true, ejecutadoAt: new Date(), factoresJson: JSON.stringify(parseJson<{ factor: string; senal: number; aporte: number }[]>(macroDb.factoresJson, [])) },
  })

  // 6) Generar datos de los estudios comprados este año
  await generarDatosEstudiosIndustria(industria.id, anio)

  // 7) Evaluar proyectos I+D iniciados este año (sorteo determinista)
  await evaluarProyectos(industria.id, anio)

  // 8) Puntos de desempeño: área con borrador enviado = trabajó (+5); sin borrador = sin trabajar (−10)
  const borradores = await db.borradorArea.findMany({ where: { equipoId: { in: equipoIds }, anio, enviado: true } })
  const trabajados = new Set(borradores.map((b) => `${b.equipoId}|${b.cargo}`))
  for (const equipo of industria.equipos) {
    for (const cargo of CARGOS) {
      const responsables = equipo.membresias.filter((m) => m.cargo === cargo.id)
      if (responsables.length === 0) continue
      const delta = trabajados.has(`${equipo.id}|${cargo.id}`) ? DESEMPENO.premioTrabajar : DESEMPENO.penalizacionSinTrabajar
      for (const m of responsables) {
        await db.membresia.update({ where: { id: m.id }, data: { puntos: round2(m.puntos + delta) } })
      }
    }
  }

  // 9) Avanzar el año (o finalizar la simulación)
  const nuevoAnio = anio + 1
  const finalizada = nuevoAnio > industria.anioMaximo
  await db.industria.update({
    where: { id: industria.id },
    data: {
      anioActual: finalizada ? industria.anioMaximo : nuevoAnio,
      estado: finalizada ? 'FINALIZADA' : 'ACTIVA',
    },
  })

  return {
    anioProcesado: anio,
    anioNuevo: finalizada ? industria.anioMaximo : nuevoAnio,
    finalizada,
    equiposSinVistoBueno: equiposSinVistoBueno.map((e) => e.nombre),
    ventasTotales: resultado.ventasEmpresas,
    inflacion: macroDb.inflacionAnual,
    escenario: macroDb.escenario,
    eventosAplicados: eventosDb.filter((e) => e.activo).length,
    capturaEmpresas: resultado.capturaEmpresas,
  }
}

/** Aplica proyectos I+D aprobados a marcas existentes ya se hizo en decisiones; aquí solo se evalúan los nuevos. */
async function evaluarProyectos(industriaId: string, anio: number) {
  const equipos = await db.equipo.findMany({ where: { industriaId } })
  for (const equipo of equipos) {
    const proyectos = await db.proyectoID.findMany({
      where: { equipoId: equipo.id, estado: 'EN_DESARROLLO', anioInicio: anio },
    })
    for (const p of proyectos) {
      const atributos = parseJson<number[]>(p.atributos, [5, 5, 5, 5, 5, 5])
      const prob = probabilidadExito(atributos, p.presupuesto)
      const draw = hash01(`${industriaId}|${equipo.id}|${p.nombre}|${anio}`)
      const aprobado = draw < prob
      await db.proyectoID.update({
        where: { id: p.id },
        data: { estado: aprobado ? 'APROBADO' : 'FALLIDO', probabilidad: prob },
      })
    }
  }
}

async function generarDatosEstudiosIndustria(industriaId: string, anio: number) {
  const equipos = await db.equipo.findMany({ where: { industriaId } })
  const equipoPorId = new Map(equipos.map((e) => [e.id, e]))
  const marcasDb = await db.marca.findMany({ where: { equipoId: { in: equipos.map((e) => e.id) }, activa: true } })

  const compras = await db.compraEstudio.findMany({
    where: { anio, datos: null, equipoId: { in: equipos.map((e) => e.id) } },
  })

  for (const compra of compras) {
    const ctxMarcas: MarcaContexto[] = marcasDb.map((m) => {
      const equipo = equipoPorId.get(m.equipoId)
      return {
        marcaId: m.id,
        equipoId: m.equipoId,
        nombre: m.nombre,
        precio: m.precio,
        publicidad: m.publicidad,
        produccion: m.produccion,
        costoUnitario: m.costoUnitario,
        atributos: parseJson<number[]>(m.atributos, [5, 5, 5, 5, 5, 5]),
        vendedores: parseJson<number[]>(m.vendedores, [10, 5, 3]),
        inventario: m.inventario,
        awareness: m.awareness,
        firma: equipo?.nombre ?? '—',
        esPropia: m.equipoId === compra.equipoId,
      }
    })
    const datos = generarDatosEstudio(compra.estudioId, {
      anio,
      equipoId: compra.equipoId,
      marcas: ctxMarcas,
    })
    await db.compraEstudio.update({ where: { id: compra.id }, data: { datos: JSON.stringify(datos) } })
  }
}
/** Ranking de equipos por contribución acumulada. */
export async function rankingIndustria(industriaId: string) {
  const equipos = await db.equipo.findMany({ where: { industriaId } })
  const reportes = await db.reporte.findMany({ where: { equipoId: { in: equipos.map((e) => e.id) } } })
  const lista = equipos.map((e) => {
    const reps = reportes.filter((r) => r.equipoId === e.id)
    return {
      equipoId: e.id,
      nombre: e.nombre,
      color: e.color,
      contribucionAcumulada: round1Safe(reps.reduce((s, r) => s + r.contribucion, 0)),
      ingresosAcumulados: round1Safe(reps.reduce((s, r) => s + r.ingresos, 0)),
      ventasAcumuladas: round1Safe(reps.reduce((s, r) => s + r.ventas, 0)),
      participacionUltima: reps.length
        ? Math.max(...reps.map((r) => r.anio)) >= 0
          ? (reps.find((r) => r.anio === Math.max(...reps.map((x) => x.anio)))?.participacion ?? 0)
          : 0
        : 0,
      rondasJugadas: reps.length,
    }
  })
  lista.sort((a, b) => b.contribucionAcumulada - a.contribucionAcumulada)
  return lista.map((l, i) => ({ ...l, posicion: i + 1 }))
}

// ===================== Borradores por área (comité) =====================

function contextoEquipo(equipoId: string) {
  return db.equipo.findUnique({ where: { id: equipoId }, include: { industria: true } })
}

/**
 * Verifica que el alumno pueda trabajar en UNA área del comité:
 *  · siempre puede su gerente responsable (su cargo en la Membresía), o
 *  · cualquier integrante si el encargado del área abrió el permiso (PermisoArea.abierto).
 *  Si no, lanza error «Área bloqueada».
 */
async function autorizarArea(equipoId: string, usuarioId: string, cargo: string) {
  const membresia = await db.membresia.findUnique({ where: { equipoId_usuarioId: { equipoId, usuarioId } } })
  if (!membresia) throw new PachaError('No eres gerente de esta empresa', 403)
  if (membresia.cargo === cargo) return
  const permiso = await db.permisoArea.findUnique({ where: { equipoId_cargo: { equipoId, cargo } } })
  if (!permiso?.abierto) {
    const encargado = await db.membresia.findFirst({
      where: { equipoId, cargo },
      include: { usuario: { select: { nombre: true } } },
    })
    throw new PachaError(
      `Área bloqueada: solo ${encargado?.usuario.nombre ?? 'su gerente'} puede trabajarla hasta que te dé permiso`,
      403
    )
  }
}

/**
 * El gerente responsable de un área abre o cierra el acceso del equipo a su área.
 * Solo el encargado actual del cargo puede cambiarlo.
 */
export async function cambiarPermisoArea(equipoId: string, usuarioId: string, cargo: string, abierto: boolean) {
  if (!esCargoValido(cargo)) throw new PachaError('Cargo inválido')
  const membresia = await db.membresia.findUnique({ where: { equipoId_usuarioId: { equipoId, usuarioId } } })
  if (!membresia) throw new PachaError('No eres gerente de esta empresa', 403)
  if (membresia.cargo !== cargo) throw new PachaError('Solo el encargado del área puede cambiar su permiso', 403)
  await db.permisoArea.upsert({
    where: { equipoId_cargo: { equipoId, cargo } },
    update: { abierto },
    create: { equipoId, cargo, abierto },
  })
  return { ok: true, cargo, abierto }
}

/** Guarda y ENVÍA el borrador de una área del comité (queda visible para todo el equipo).
 *  Corrección: cada área está BLOQUEADA para el equipo; solo puede trabajarla su
 *  gerente responsable, salvo que este haya abierto el permiso de su área. */
export async function guardarBorradorArea(
  equipoId: string,
  usuarioId: string,
  cargo: string,
  contenido: unknown
) {
  if (!esCargoValido(cargo)) throw new PachaError('Cargo inválido')
  const equipo = await contextoEquipo(equipoId)
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')

  await autorizarArea(equipoId, usuarioId, cargo)

  const anio = equipo.industria.anioActual
  const decision = await db.decision.findUnique({ where: { equipoId_anio: { equipoId, anio } } })
  if (decision && decision.estado !== 'BORRADOR') {
    throw new PachaError('La decisión del año ya fue enviada al docente')
  }

  const previo = await db.borradorArea.findUnique({
    where: { equipoId_anio_cargo: { equipoId, anio, cargo } },
  })
  const data = {
    contenido: JSON.stringify(contenido ?? {}),
    enviado: true,
    enviadoPorId: usuarioId,
    enviadoAt: new Date(),
  }
  if (previo) {
    await db.borradorArea.update({ where: { id: previo.id }, data })
  } else {
    await db.borradorArea.create({ data: { equipoId, anio, cargo, ...data } })
  }
  return { ok: true }
}

/**
 * Envía la DECISIÓN DEL AÑO al docente: consolida los borradores enviados de las
 * 5 áreas; las áreas sin borrador usan los valores predeterminados (vigentes de
 * las marcas) y quedan marcadas como "sin trabajar".
 */
export async function enviarDecision(equipoId: string, usuarioId: string) {
  const equipo = await contextoEquipo(equipoId)
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')

  const anio = equipo.industria.anioActual
  const previa = await db.decision.findUnique({ where: { equipoId_anio: { equipoId, anio } } })
  if (previa && previa.estado !== 'BORRADOR') throw new PachaError('La decisión del año ya fue enviada')

  // Membresía del remitente (para registrar quién envió)
  const membresia = await db.membresia.findUnique({
    where: { equipoId_usuarioId: { equipoId, usuarioId } },
  })
  if (!membresia) throw new PachaError('No eres gerente de esta empresa', 403)

  const marcas = await db.marca.findMany({ where: { equipoId, activa: true }, orderBy: { anioLanzamiento: 'asc' } })
  const borradores = await db.borradorArea.findMany({ where: { equipoId, anio, enviado: true } })
  const porCargo = new Map(borradores.map((b) => [b.cargo, parseJson<Record<string, unknown>>(b.contenido, {})]))

  // Valores predeterminados = valores vigentes de cada marca
  const contenido: DecisionContenido = {
    marcas: marcas.map((m) => ({
      marcaId: m.id,
      precio: m.precio,
      publicidad: m.publicidad,
      produccion: m.produccion,
      vendedores: parseJson<number[]>(m.vendedores, [10, 5, 3]),
    })),
    nuevas: [],
    estudios: [],
  }

  // Aplicar los borradores de cada área sobre los predeterminados
  const bPrecios = porCargo.get('precios') as { precios?: { marcaId: string; precio: number }[] } | undefined
  for (const p of bPrecios?.precios ?? []) {
    const dm = contenido.marcas.find((x) => x.marcaId === p.marcaId)
    if (dm) dm.precio = clampNum(p.precio, 1, 60)
  }
  const bPublicidad = porCargo.get('publicidad') as { publicidades?: { marcaId: string; publicidad: number }[] } | undefined
  for (const p of bPublicidad?.publicidades ?? []) {
    const dm = contenido.marcas.find((x) => x.marcaId === p.marcaId)
    if (dm) dm.publicidad = clampNum(p.publicidad, 0, 5000)
  }
  const bProduccion = porCargo.get('produccion') as { producciones?: { marcaId: string; produccion: number }[] } | undefined
  for (const p of bProduccion?.producciones ?? []) {
    const dm = contenido.marcas.find((x) => x.marcaId === p.marcaId)
    if (dm) dm.produccion = clampNum(p.produccion, 0, 20000)
  }
  const bVentas = porCargo.get('ventas') as { ventas?: { marcaId: string; vendedores: number[] }[] } | undefined
  for (const p of bVentas?.ventas ?? []) {
    const dm = contenido.marcas.find((x) => x.marcaId === p.marcaId)
    if (dm) dm.vendedores = (p.vendedores ?? []).map((v) => clampNum(Number(v) || 0, 0, 100))
  }
  const bProd = porCargo.get('produccion') as { producciones?: { marcaId: string; produccion: number }[]; inversionCapacidad?: number } | undefined
  if (bProd?.inversionCapacidad && bProd.inversionCapacidad > 0) {
    contenido.inversionCapacidad = clampNum(bProd.inversionCapacidad, 0, 3000)
  }
  const bInvestigacion = porCargo.get('investigacion') as BorradorInvestigacion | undefined
  if (bInvestigacion) {
    contenido.nuevas = Array.isArray(bInvestigacion.nuevas) ? bInvestigacion.nuevas : []
    contenido.estudios = Array.isArray(bInvestigacion.estudios) ? bInvestigacion.estudios : []
  }

  // Congelar costo de estudios al enviar
  for (const estudioId of contenido.estudios) {
    const def = ESTUDIOS.find((e) => e.id === estudioId)
    if (!def) continue
    await db.compraEstudio.upsert({
      where: { equipoId_anio_estudioId: { equipoId, anio, estudioId } },
      create: { equipoId, anio, estudioId, costo: def.costo },
      update: { costo: def.costo },
    })
  }

  const data = JSON.stringify(contenido)
  if (previa) {
    await db.decision.update({ where: { id: previa.id }, data: { estado: 'ENVIADA', contenido: data } })
  } else {
    await db.decision.create({ data: { equipoId, anio, estado: 'ENVIADA', contenido: data } })
  }

  const cargosEnviados = new Set(borradores.map((b) => b.cargo))
  const areasSinTrabajar = CARGOS.filter((c) => !cargosEnviados.has(c.id)).map((c) => c.id)
  return { ok: true, areasSinTrabajar, estudiosComprados: contenido.estudios.length }
}

/** El docente da (o retira) el visto bueno a la decisión del año de una empresa. */
export async function aprobarDecision(decisionId: string, profesorId: string, aprobada: boolean) {
  const decision = await db.decision.findUnique({
    where: { id: decisionId },
    include: { equipo: { include: { industria: true } } },
  })
  if (!decision) throw new PachaError('Decisión no encontrada', 404)
  if (decision.equipo.industria.profesorId !== profesorId) throw new PachaError('No es tu industria', 403)
  if (decision.estado === 'BORRADOR') throw new PachaError('La empresa todavía no envió su decisión')
  await db.decision.update({
    where: { id: decision.id },
    data: { estado: aprobada ? 'APROBADA' : 'ENVIADA' },
  })
  return { ok: true, estado: aprobada ? 'APROBADA' : 'ENVIADA' }
}

// ===================== Desempeño y penalizaciones =====================

/** El comité penaliza a un gerente con puntos muy negativos (menú definido por el grupo). */
export async function penalizarGerente(
  equipoId: string,
  objetivoUsuarioId: string,
  tipo: 'AMONESTACION' | 'PUNTOS' | 'EXPULSION',
  puntosRestar: number,
  motivo: string,
  registradoPorId: string,
  anioActual: number
) {
  const equipo = await contextoEquipo(equipoId)
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')

  const objetivo = await db.membresia.findUnique({
    where: { equipoId_usuarioId: { equipoId, usuarioId: objetivoUsuarioId } },
    include: { usuario: true },
  })
  if (!objetivo) throw new PachaError('Ese gerente no pertenece a tu empresa', 404)
  if (objetivo.puntos > DESEMPENO.umbralPenalizable) {
    throw new PachaError(`Solo se puede penalizar a un gerente con ${DESEMPENO.umbralPenalizable} puntos o menos`)
  }
  if (!['AMONESTACION', 'PUNTOS', 'EXPULSION'].includes(tipo)) throw new PachaError('Tipo de penalización inválido')

  let resta = 0
  if (tipo === 'PUNTOS') {
    resta = Math.round(clampNum(puntosRestar, 1, DESEMPENO.restaMaximaPenalizacion))
    await db.membresia.update({
      where: { id: objetivo.id },
      data: { puntos: round2(objetivo.puntos - resta) },
    })
  }
  if (tipo === 'EXPULSION') {
    await db.membresia.delete({ where: { id: objetivo.id } })
  }

  const penalizacion = await db.penalizacion.create({
    data: {
      equipoId,
      usuarioId: objetivoUsuarioId,
      tipo,
      puntos: resta,
      motivo: (motivo || '').slice(0, 300),
      anio: anioActual,
      registradaPorId: registradoPorId,
    },
  })

  return {
    ok: true,
    tipo,
    puntosRestados: resta,
    expulsado: tipo === 'EXPULSION',
    nuevoPuntos: tipo === 'PUNTOS' ? round2(objetivo.puntos - resta) : objetivo.puntos,
    penalizacionId: penalizacion.id,
  }
}

// ===================== Proyectos I+D =====================

export async function registrarProyecto(
  equipoId: string,
  nombre: string,
  atributos: number[],
  presupuesto: number
) {
  const equipo = await contextoEquipo(equipoId)
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')
  const anio = equipo.industria.anioActual

  const nombreLimpio = nombre.trim().slice(0, 24)
  if (!nombreLimpio) throw new PachaError('El proyecto necesita un nombre')
  if (atributos.length !== 6 || atributos.some((a) => a < 1 || a > 10)) {
    throw new PachaError('Los 6 atributos deben estar entre 1 y 10')
  }
  if (presupuesto < ID_CONFIG.presupuestoMin || presupuesto > ID_CONFIG.presupuestoMax) {
    throw new PachaError(`El presupuesto debe estar entre ${ID_CONFIG.presupuestoMin} y ${ID_CONFIG.presupuestoMax} miles de Bs`)
  }

  const totalNombres = await db.proyectoID.count({ where: { equipoId } })
  if (totalNombres >= ID_CONFIG.maxNombresPorSimulacion) {
    throw new PachaError(`Ya usaste los ${ID_CONFIG.maxNombresPorSimulacion} nombres de proyecto disponibles en esta simulación`)
  }

  const enDesarrollo = await db.proyectoID.count({
    where: { equipoId, estado: 'EN_DESARROLLO', anioInicio: anio },
  })
  if (enDesarrollo >= ID_CONFIG.maxProyectosPorAnio) {
    throw new PachaError(`Máximo ${ID_CONFIG.maxProyectosPorAnio} proyectos por año`)
  }

  const existente = await db.proyectoID.findUnique({ where: { equipoId_nombre: { equipoId, nombre: nombreLimpio } } })
  if (existente) {
    // Reenvío de un proyecto fallido: mismos atributos, más presupuesto
    if (existente.estado !== 'FALLIDO') throw new PachaError('Ya existe un proyecto con ese nombre')
    const attrsPrevios = parseJson<number[]>(existente.atributos, [])
    if (JSON.stringify(attrsPrevios) !== JSON.stringify(atributos)) {
      throw new PachaError('Un proyecto fallido solo se puede reenviar con los mismos atributos')
    }
    if (presupuesto <= existente.presupuesto) {
      throw new PachaError('El nuevo presupuesto debe ser mayor al anterior')
    }
    await db.proyectoID.update({
      where: { id: existente.id },
      data: { presupuesto, estado: 'EN_DESARROLLO', anioInicio: anio, probabilidad: probabilidadExito(atributos, presupuesto) },
    })
    return { ok: true, reenvio: true }
  }

  await db.proyectoID.create({
    data: {
      equipoId,
      nombre: nombreLimpio,
      atributos: JSON.stringify(atributos),
      presupuesto,
      estado: 'EN_DESARROLLO',
      anioInicio: anio,
      probabilidad: probabilidadExito(atributos, presupuesto),
    },
  })
  return { ok: true }
}

// ===================== Utilidades =====================

function clampNum(v: number, min: number, max: number): number {
  const n = Number(v)
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

function round1Safe(v: number): number {
  return Math.round(v * 10) / 10
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
