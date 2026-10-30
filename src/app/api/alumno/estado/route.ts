import { db } from '@/lib/db'
import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { parseDecision, parseJson, PachaError } from '@/lib/pacha/tipos'
import { rankingIndustria } from '@/lib/pacha/simulacion'
import { ESTUDIOS, ID_CONFIG, presupuestoNormal, probabilidadExito } from '@/lib/pacha/catalogo'

/** Estado completo de juego del alumno (HUD + datos de todas las pestañas). */
export async function GET() {
  try {
    const usuario = await requireRol('ALUMNO')
    const equipo = await db.equipo.findUnique({
      where: { alumnoId: usuario.id },
      include: { industria: true },
    })
    if (!equipo) throw new PachaError('No tienes un equipo asignado todavía. Pide al profesor que te asigne uno.', 404)

    const anio = equipo.industria.anioActual

    const [marcas, decision, proyectos, reportes, compras, ranking] = await Promise.all([
      db.marca.findMany({ where: { equipoId: equipo.id }, orderBy: { anioLanzamiento: 'asc' } }),
      db.decision.findUnique({ where: { equipoId_anio: { equipoId: equipo.id, anio } } }),
      db.proyectoID.findMany({ where: { equipoId: equipo.id }, orderBy: { anioInicio: 'asc' } }),
      db.reporte.findMany({ where: { equipoId: equipo.id }, orderBy: { anio: 'asc' } }),
      db.compraEstudio.findMany({ where: { equipoId: equipo.id }, orderBy: [{ anio: 'asc' }, { estudioId: 'asc' }] }),
      rankingIndustria(equipo.industria.id),
    ])

    // Costos ya comprometidos en estudios para este año (si la decisión fue enviada)
    const costoEstudiosAnio = compras.filter((c) => c.anio === anio).reduce((s, c) => s + c.costo, 0)

    return ok({
      usuario,
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
    })
  } catch (e) {
    return error(e)
  }
}
