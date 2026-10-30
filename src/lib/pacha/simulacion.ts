// ============================================================
// PACHA Simulador · Servicio de simulación
// El "corazón" del sistema: procesa una ronda completa en secuencia.
// ============================================================

import { db } from '@/lib/db'
import { ESTUDIOS, ID_CONFIG, costoUnitarioDesdeAtributos, probabilidadExito } from './catalogo'
import { generarDatosEstudio, type MarcaContexto } from './estudios'
import { hash01 } from './hash'
import { reportesAnio0, simularAnio, type MarcaSim } from './motor'
import { PachaError, parseDecision, parseJson } from './tipos'

const MARCAS_INICIALES = {
  precio: 8,
  publicidad: 150,
  produccion: 400,
  atributos: [5, 5, 5, 5, 5, 5],
  vendedores: [12, 6, 4],
}

/** Crea una industria nueva con equipos, marcas iniciales y reportes del Año 0. */
export async function crearIndustria(nombre: string, profesorId: string, nombresEquipos: string[]) {
  if (!nombre.trim()) throw new PachaError('La industria necesita un nombre')
  if (nombresEquipos.length < 2) throw new PachaError('Se necesitan al menos 2 equipos')

  const industria = await db.industria.create({
    data: { nombre: nombre.trim(), profesorId, anioActual: 1, anioMaximo: 10 },
  })

  for (let i = 0; i < nombresEquipos.length; i++) {
    const nombreEquipo = nombresEquipos[i].trim() || `Equipo ${i + 1}`
    const equipo = await db.equipo.create({
      data: { nombre: nombreEquipo, industriaId: industria.id, color: EQUIPO_COLORES_SAFE[i % EQUIPO_COLORES_SAFE.length] },
    })
    await db.marca.create({
      data: {
        equipoId: equipo.id,
        nombre: `${nombreEquipo.split(' ')[0].slice(0, 8)} Clásica`,
        precio: MARCAS_INICIALES.precio,
        publicidad: MARCAS_INICIALES.publicidad,
        produccion: MARCAS_INICIALES.produccion,
        costoUnitario: costoUnitarioDesdeAtributos(MARCAS_INICIALES.atributos),
        atributos: JSON.stringify(MARCAS_INICIALES.atributos),
        vendedores: JSON.stringify(MARCAS_INICIALES.vendedores),
        inventario: 0,
        awareness: 0.05,
        anioLanzamiento: 0,
      },
    })
  }

  // Año 0: diagnóstico inicial
  await generarReportesAnio0(industria.id)
  return industria
}

const EQUIPO_COLORES_SAFE = ['#f472b6', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf', '#22d3ee', '#a3e635']

async function generarReportesAnio0(industriaId: string) {
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
  const { marcas, equipos: resultados } = reportesAnio0(todas)

  for (const r of resultados) {
    await guardarReporte(r.equipoId, 0, r, marcas.filter((m) => m.equipoId === r.equipoId), false)
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
  investigacionMercado = 0
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

/**
 * Procesa la ronda del año actual de la industria:
 * 1) lee decisiones enviadas · 2) aplica I+D aprobado · 3) ejecuta el motor ·
 * 4) guarda reportes · 5) actualiza estado de marcas · 6) genera estudios ·
 * 7) evalúa proyectos I+D · 8) avanza el año.
 */
export async function procesarRonda(industriaId: string) {
  const industria = await db.industria.findUnique({
    where: { id: industriaId },
    include: { equipos: { include: { marcas: true } } },
  })
  if (!industria) throw new PachaError('Industria no encontrada', 404)
  if (industria.estado !== 'ACTIVA') throw new PachaError('La simulación ya finalizó')
  if (industria.anioActual > industria.anioMaximo) throw new PachaError('Ya se alcanzó el año máximo')

  const anio = industria.anioActual
  const equipoIds = industria.equipos.map((e) => e.id)

  // 1) Decisiones efectivas (enviadas) de este año
  const decisiones = await db.decision.findMany({
    where: { equipoId: { in: equipoIds }, anio, estado: 'ENVIADA' },
  })
  const decisionPorEquipo = new Map(decisiones.map((d) => [d.equipoId, d]))
  const equiposSinDecision = industria.equipos.filter((e) => !decisionPorEquipo.has(e.id))

  // 2) Aplicar decisiones a las marcas (y proyectos I+D de lanzamiento)
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
          precio: clampNum(dm.precio, 1, 60),
          publicidad: clampNum(dm.publicidad, 0, 5000),
          produccion: clampNum(dm.produccion, 0, 20000),
          vendedores: JSON.stringify(dm.vendedores.map((v) => clampNum(v, 0, 100))),
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
          precio: clampNum(dn.precio, 1, 60),
          publicidad: clampNum(dn.publicidad, 0, 5000),
          produccion: clampNum(dn.produccion, 0, 20000),
          costoUnitario: costoUnitarioDesdeAtributos(atributos),
          atributos: JSON.stringify(atributos),
          vendedores: JSON.stringify(dn.vendedores.map((v) => clampNum(v, 0, 100))),
          inventario: 0,
          awareness: 0.05,
          anioLanzamiento: anio,
        },
      })
      await db.proyectoID.update({ where: { id: proyecto.id }, data: { estado: 'APLICADO' } })
    }
  }

  // 3) Ejecutar el motor con todas las marcas activas (valores vigentes)
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
  const resultado = simularAnio(anio, marcasSim)
  const resultadoPorMarca = new Map(resultado.marcas.map((r) => [r.marcaId, r]))
  const resultadoPorEquipo = new Map(resultado.equipos.map((r) => [r.equipoId, r]))

  // 4) Guardar reportes (incluye equipos sin decisión: el motor usa valores vigentes)
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
    await guardarReporte(
      equipo.id,
      anio,
      agg,
      marcasRep,
      !decisionPorEquipo.has(equipo.id),
      round1Safe(gastosEstudios._sum.costo ?? 0)
    )
  }

  // 5) Actualizar estado de las marcas para el año siguiente (awareness, inventario)
  for (const r of resultado.marcas) {
    await db.marca.update({
      where: { id: r.marcaId },
      data: { awareness: r.awarenessNueva, inventario: r.inventarioFinal },
    })
  }

  // 6) Generar datos de los estudios comprados este año
  await generarDatosEstudiosIndustria(industria.id, anio)

  // 7) Evaluar proyectos I+D iniciados este año (sorteo determinista)
  await evaluarProyectos(industria.id, anio)

  // 8) Avanzar el año (o finalizar la simulación)
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
    equiposSinDecision: equiposSinDecision.map((e) => e.nombre),
    ventasTotales: resultado.ventasTotales,
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

// ===================== Decisiones del alumno =====================

export async function guardarBorrador(equipoId: string, contenido: unknown) {
  const equipo = await db.equipo.findUnique({ where: { id: equipoId }, include: { industria: true } })
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')

  const anio = equipo.industria.anioActual
  const existente = await db.decision.findUnique({ where: { equipoId_anio: { equipoId, anio } } })
  if (existente?.estado === 'ENVIADA') throw new PachaError('La decisión ya fue enviada y no se puede modificar')

  const data = JSON.stringify(contenido)
  if (existente) {
    await db.decision.update({ where: { id: existente.id }, data: { contenido: data } })
  } else {
    await db.decision.create({ data: { equipoId, anio, estado: 'BORRADOR', contenido: data } })
  }
  return { ok: true }
}

/** Envía la decisión: congela el costo de los estudios y bloquea la hoja. */
export async function enviarDecision(equipoId: string) {
  const equipo = await db.equipo.findUnique({ where: { id: equipoId }, include: { industria: true } })
  if (!equipo) throw new PachaError('Equipo no encontrado', 404)
  if (equipo.industria.estado !== 'ACTIVA') throw new PachaError('La simulación finalizó')

  const anio = equipo.industria.anioActual
  const decision = await db.decision.findUnique({ where: { equipoId_anio: { equipoId, anio } } })
  if (!decision) throw new PachaError('No hay borrador para enviar')
  if (decision.estado === 'ENVIADA') throw new PachaError('La decisión ya fue enviada')

  const contenido = parseDecision(decision.contenido)

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

  await db.decision.update({ where: { id: decision.id }, data: { estado: 'ENVIADA' } })
  return { ok: true, estudiosComprados: contenido.estudios.length }
}

// ===================== Proyectos I+D =====================

export async function registrarProyecto(
  equipoId: string,
  nombre: string,
  atributos: number[],
  presupuesto: number
) {
  const equipo = await db.equipo.findUnique({ where: { id: equipoId }, include: { industria: true } })
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
