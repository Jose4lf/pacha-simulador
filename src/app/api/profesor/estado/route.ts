import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { parseDecision, PachaError } from '@/lib/pacha/tipos'
import { rankingIndustria } from '@/lib/pacha/simulacion'
import { CARGOS } from '@/lib/pacha/catalogo'

/** Panel del profesor: sus industrias, comités, decisiones (con contenido) y ranking. */
export async function GET() {
  try {
    const usuario = await requireRol('PROFESOR')
    const industrias = await db.industria.findMany({
      where: { profesorId: usuario.id },
      orderBy: { createdAt: 'desc' },
      include: {
        equipos: {
          include: {
            marcas: true,
            membresias: { include: { usuario: { select: { id: true, nombre: true } } }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    })

    const resultado: {
      id: string
      nombre: string
      anioActual: number
      anioMaximo: number
      estado: string
      equipos: {
        id: string
        nombre: string
        color: string
        numMarcas: number
        integrantes: { usuarioId: string; nombre: string; cargo: string; puntos: number }[]
        decisionEstado: string
        decisionId: string | null
        aprobada: boolean
        contenido: ReturnType<typeof parseDecision> | null
        areasSinBorrador: string[]
        areasTrabajadas: string[]
      }[]
      ranking: Awaited<ReturnType<typeof rankingIndustria>>
    }[] = []

    for (const ind of industrias) {
      const ranking = await rankingIndustria(ind.id)
      const decisiones = await db.decision.findMany({
        where: { equipoId: { in: ind.equipos.map((e) => e.id) }, anio: ind.anioActual },
      })
      const borradores = await db.borradorArea.findMany({
        where: { equipoId: { in: ind.equipos.map((e) => e.id) }, anio: ind.anioActual, enviado: true },
      })

      const equipos = ind.equipos.map((e) => {
        const dec = decisiones.find((d) => d.equipoId === e.id)
        const enviados = new Set(borradores.filter((b) => b.equipoId === e.id).map((b) => b.cargo))
        return {
          id: e.id,
          nombre: e.nombre,
          color: e.color,
          numMarcas: e.marcas.length,
          marcas: e.marcas
            .filter((m) => m.activa)
            .sort((a, b) => a.anioLanzamiento - b.anioLanzamiento)
            .map((m) => ({ id: m.id, nombre: m.nombre })),
          integrantes: e.membresias.map((m) => ({
            usuarioId: m.usuario.id,
            nombre: m.usuario.nombre,
            cargo: m.cargo,
            representante: m.representante,
            puntos: m.puntos,
          })),
          decisionEstado: dec?.estado ?? 'PENDIENTE',
          decisionId: dec?.id ?? null,
          aprobada: dec?.estado === 'APROBADA',
          contenido: dec ? parseDecision(dec.contenido) : null,
          areasSinBorrador: CARGOS.filter((c) => !enviados.has(c.id)).map((c) => c.id),
          areasTrabajadas: CARGOS.filter((c) => enviados.has(c.id)).map((c) => c.id),
        }
      })
      resultado.push({
        id: ind.id,
        nombre: ind.nombre,
        anioActual: ind.anioActual,
        anioMaximo: ind.anioMaximo,
        estado: ind.estado,
        equipos,
        ranking,
      })
    }

    return ok({ industrias: resultado })
  } catch (e) {
    return error(e)
  }
}
