import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { parseDecision, PachaError } from '@/lib/pacha/tipos'
import { rankingIndustria } from '@/lib/pacha/simulacion'

/** Panel del profesor: sus industrias, equipos, estado de envíos y ranking. */
export async function GET() {
  try {
    const usuario = await requireRol('PROFESOR')
    const industrias = await db.industria.findMany({
      where: { profesorId: usuario.id },
      orderBy: { createdAt: 'desc' },
      include: {
        equipos: {
          include: {
            alumno: { select: { id: true, nombre: true } },
            marcas: true,
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
        alumno: string | null
        numMarcas: number
        decisionEstado: string
        enviada: boolean
        sinBorrador: boolean
      }[]
      ranking: Awaited<ReturnType<typeof rankingIndustria>>
      alumnosDisponibles: { id: string; nombre: string }[]
    }[] = []
    for (const ind of industrias) {
      const ranking = await rankingIndustria(ind.id)
      const decisiones = await db.decision.findMany({
        where: { equipoId: { in: ind.equipos.map((e) => e.id) }, anio: ind.anioActual },
      })
      const equipos = ind.equipos.map((e) => {
        const dec = decisiones.find((d) => d.equipoId === e.id)
        return {
          id: e.id,
          nombre: e.nombre,
          color: e.color,
          alumno: e.alumno?.nombre ?? null,
          numMarcas: e.marcas.length,
          decisionEstado: dec?.estado ?? 'PENDIENTE',
          enviada: dec?.estado === 'ENVIADA',
          sinBorrador: !dec,
        }
      })
      const alumnosDisponibles = await db.usuario.findMany({
        where: { rol: 'ALUMNO' },
        select: { id: true, nombre: true },
      })
      resultado.push({
        id: ind.id,
        nombre: ind.nombre,
        anioActual: ind.anioActual,
        anioMaximo: ind.anioMaximo,
        estado: ind.estado,
        equipos,
        ranking,
        alumnosDisponibles,
      })
    }

    return ok({ industrias: resultado })
  } catch (e) {
    return error(e)
  }
}
