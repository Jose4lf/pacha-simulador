import { db } from '@/lib/db'
import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { parseDecision, parseJson, PachaError } from '@/lib/pacha/tipos'
import { rankingIndustria } from '@/lib/pacha/simulacion'
import { CARGOS, DESEMPENO, ESTUDIOS, ID_CONFIG, presupuestoNormal, probabilidadExito } from '@/lib/pacha/catalogo'

/** Estado completo de juego del alumno (HUD + comité + borradores + datos de todas las pestañas). */
export async function GET() {
  try {
    const usuario = await requireRol('ALUMNO')

    const membresia = await db.membresia.findFirst({
      where: { usuarioId: usuario.id },
      include: { equipo: { include: { industria: true } } },
    })
    if (!membresia) {
      throw new PachaError('No perteneces a ninguna empresa todavía. Pide al profesor que te asigne a una.', 404)
    }
    const equipo = membresia.equipo
    const anio = equipo.industria.anioActual

    const [marcas, decision, proyectos, reportes, compras, ranking, comite, borradores, penalizaciones, permisos, eventosPeriodo, marcasHistoria] = await Promise.all([
      db.marca.findMany({ where: { equipoId: equipo.id }, orderBy: { anioLanzamiento: 'asc' } }),
      db.decision.findUnique({ where: { equipoId_anio: { equipoId: equipo.id, anio } } }),
      db.proyectoID.findMany({ where: { equipoId: equipo.id }, orderBy: { anioInicio: 'asc' } }),
      db.reporte.findMany({ where: { equipoId: equipo.id }, orderBy: { anio: 'asc' } }),
      db.compraEstudio.findMany({ where: { equipoId: equipo.id }, orderBy: [{ anio: 'asc' }, { estudioId: 'asc' }] }),
      rankingIndustria(equipo.industria.id),
      db.membresia.findMany({
        where: { equipoId: equipo.id },
        include: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.borradorArea.findMany({
        where: { equipoId: equipo.id, anio },
        include: { enviadoPor: { select: { id: true, nombre: true } } },
      }),
      db.penalizacion.findMany({
        where: { equipoId: equipo.id },
        include: {
          usuario: { select: { id: true, nombre: true } },
          registradaPor: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.permisoArea.findMany({ where: { equipoId: equipo.id } }),
      // Eventos que ocurren (u ocurrieron) DENTRO de esta simulación, por año,
      // con sus propiedades (categoría, región, meses, efectos) — doc §15.
      db.eventoPeriodo.findMany({
        where: { industriaId: equipo.industria.id, anio: { lte: anio } },
        orderBy: [{ anio: 'asc' }, { nombre: 'asc' }],
      }),
      // Datos contables por marca y año (reportes del equipo) para las pestañas de área
      db.reporteMarca.findMany({
        where: { reporte: { equipoId: equipo.id } },
        include: { reporte: { select: { anio: true } } },
        orderBy: { id: 'asc' },
      }),
    ])

    // Costos ya comprometidos en estudios para este año (si la decisión fue enviada)
    const costoEstudiosAnio = compras.filter((c) => c.anio === anio).reduce((s, c) => s + c.costo, 0)

    return ok({
      usuario,
      membresia: { cargo: membresia.cargo, puntos: membresia.puntos },
      equipo: { id: equipo.id, nombre: equipo.nombre, color: equipo.color },
      industria: {
        id: equipo.industria.id,
        nombre: equipo.industria.nombre,
        anioActual: anio,
        anioMaximo: equipo.industria.anioMaximo,
        estado: equipo.industria.estado,
      },
      marcas: marcas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        precio: m.precio,
        publicidad: m.publicidad,
        produccion: m.produccion,
        costoUnitario: m.costoUnitario,
        atributos: parseJson<number[]>(m.atributos, [5, 5, 5, 5, 5, 5]),
        vendedores: parseJson<number[]>(m.vendedores, [10, 5, 3]),
        inventario: m.inventario,
        awareness: m.awareness,
        anioLanzamiento: m.anioLanzamiento,
      })),
      decision: decision
        ? { estado: decision.estado, contenido: parseDecision(decision.contenido) }
        : null,
      comite: comite.map((m) => ({
        usuarioId: m.usuario.id,
        nombre: m.usuario.nombre,
        cargo: m.cargo,
        puntos: m.puntos,
      })),
      borradores: borradores
        .filter((b) => b.enviado)
        .map((b) => ({
          cargo: b.cargo,
          contenido: parseJson<Record<string, unknown>>(b.contenido, {}),
          enviadoPor: b.enviadoPor?.nombre ?? '—',
          enviadoPorId: b.enviadoPor?.id ?? null,
          enviadoAt: b.enviadoAt?.toISOString() ?? null,
          updatedAt: b.updatedAt.toISOString(),
        })),
      penalizaciones: penalizaciones.map((p) => ({
        id: p.id,
        usuarioId: p.usuario.id,
        gerente: p.usuario.nombre,
        tipo: p.tipo,
        puntos: p.puntos,
        motivo: p.motivo,
        anio: p.anio,
        registradaPor: p.registradaPor.nombre,
        createdAt: p.createdAt.toISOString(),
      })),
      cargos: CARGOS,
      desempeno: DESEMPENO,
      proyectos: proyectos.map((p) => {
        const attrs = parseJson<number[]>(p.atributos, [5, 5, 5, 5, 5, 5])
        return {
          id: p.id,
          nombre: p.nombre,
          atributos: attrs,
          presupuesto: p.presupuesto,
          estado: p.estado,
          anioInicio: p.anioInicio,
          probabilidad: p.probabilidad || probabilidadExito(attrs, p.presupuesto),
          presupuestoNormal: presupuestoNormal(attrs),
        }
      }),
      reportes: reportes.map((r) => ({
        anio: r.anio,
        ventas: r.ventas,
        ingresos: r.ingresos,
        costos: r.costos,
        publicidad: r.publicidad,
        fuerzaVentas: r.fuerzaVentas,
        investigacionMercado: r.investigacionMercado,
        contribucion: r.contribucion,
        participacion: r.participacion,
        sinDecision: r.sinDecision,
      })),
      estudiosComprados: compras.map((c) => ({
        anio: c.anio,
        estudioId: c.estudioId,
        costo: c.costo,
        tieneDatos: Boolean(c.datos),
      })),
      costoEstudiosAnio,
      ranking,
      config: { id: ID_CONFIG, catalogoEstudios: ESTUDIOS },
      // Permisos de área: qué áreas abrió el encargado al resto del equipo
      permisos: permisos.map((p) => ({ cargo: p.cargo, abierto: p.abierto })),
      // Eventos de la simulación por año, con sus propiedades (doc §15)
      eventos: eventosPeriodo.map((e) => ({
        anio: e.anio,
        nombre: e.nombre,
        categoria: e.categoria,
        region: e.region,
        meses: parseJson<number[]>(e.mesesJson, []),
        efectoDemanda: e.efectoDemanda,
        efectoCosto: e.efectoCosto,
        efectoLogistica: e.efectoLogistica,
        canal: e.canal,
        origen: e.origen,
        activo: e.activo,
      })),
      // Historia contable por marca y año (para las pestañas de cada área)
      marcasHistoria: marcasHistoria.map((m) => ({
        anio: m.reporte.anio,
        marcaNombre: m.marcaNombre,
        ventas: m.ventas,
        produccion: m.produccion,
        inventario: m.inventario,
        ingresos: m.ingresos,
        costos: m.costos,
        contribucion: m.contribucion,
        participacion: m.participacion,
        porCanal: parseJson<{ canalId: string; ventas: number }[]>(m.porCanal, []),
      })),
    })
  } catch (e) {
    return error(e)
  }
}
