import { error, ok } from '@/lib/pacha/api-helpers'
import { requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { rankingIndustria } from '@/lib/pacha/simulacion'

/** Vista del decano: usuarios, industrias y estadísticas del sistema. */
export async function GET() {
  try {
    await requireRol('DECANO')

    const [usuarios, industrias] = await Promise.all([
      db.usuario.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, nombre: true, rol: true, createdAt: true } }),
      db.industria.findMany({ include: { profesor: { select: { nombre: true } }, equipos: true }, orderBy: { createdAt: 'desc' } }),
    ])

    const industriasOut: {
      id: string
      nombre: string
      profesor: string
      anioActual: number
      anioMaximo: number
      estado: string
      numEquipos: number
      lider: string | null
    }[] = []
    for (const ind of industrias) {
      const ranking = await rankingIndustria(ind.id)
      industriasOut.push({
        id: ind.id,
        nombre: ind.nombre,
        profesor: ind.profesor.nombre,
        anioActual: ind.anioActual,
        anioMaximo: ind.anioMaximo,
        estado: ind.estado,
        numEquipos: ind.equipos.length,
        lider: ranking[0]?.nombre ?? null,
      })
    }

    return ok({
      usuarios,
      industrias: industriasOut,
      stats: {
        totalUsuarios: usuarios.length,
        profesores: usuarios.filter((u) => u.rol === 'PROFESOR').length,
        alumnos: usuarios.filter((u) => u.rol === 'ALUMNO').length,
        simulaciones: industrias.length,
      },
    })
  } catch (e) {
    return error(e)
  }
}
