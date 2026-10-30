// Bootstrap del sistema: usuarios demo + industria inicial (idempotente)
import { db } from '@/lib/db'
import { hashPassword } from './auth'
import { crearIndustria } from './simulacion'

const DEMO_PASSWORD = '321'

let seedPromise: Promise<void> | null = null

export function seedSistema(): Promise<void> {
  if (!seedPromise) seedPromise = ejecutarSeed().catch((e) => { seedPromise = null; throw e })
  return seedPromise
}

async function ejecutarSeed(): Promise<void> {
  const admin = await db.usuario.findUnique({ where: { nombre: 'Admin' } })
  if (admin) return // ya inicializado

  const passHash = hashPassword(DEMO_PASSWORD)

  await db.usuario.create({ data: { nombre: 'Admin', passwordHash: passHash, rol: 'DECANO' } })
  const profe = await db.usuario.create({ data: { nombre: 'profe', passwordHash: passHash, rol: 'PROFESOR' } })

  const alumnos = ['colibri', 'kallpa', 'inti', 'pachamama']
  const usuariosAlumno: { id: string; nombre: string }[] = []
  for (const a of alumnos) {
    usuariosAlumno.push(await db.usuario.create({ data: { nombre: a, passwordHash: passHash, rol: 'ALUMNO' } }))
  }

  const industria = await crearIndustria(
    'Helados Markestrat Bolivia',
    profe.id,
    ['Colibrí', 'Kallpa', 'Inti', 'Pachamama']
  )

  const equipos = await db.equipo.findMany({ where: { industriaId: industria.id }, orderBy: { createdAt: 'asc' } })
  for (let i = 0; i < Math.min(equipos.length, usuariosAlumno.length); i++) {
    await db.equipo.update({ where: { id: equipos[i].id }, data: { alumnoId: usuariosAlumno[i].id } })
  }
}
