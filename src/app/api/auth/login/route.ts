import { db } from '@/lib/db'
import { error, ok, body } from '@/lib/pacha/api-helpers'
import { setSessionCookie, verifyPassword } from '@/lib/pacha/auth'
import { seedSistema } from '@/lib/pacha/seed'
import { PachaError } from '@/lib/pacha/tipos'

export async function POST(req: Request) {
  try {
    await seedSistema() // bootstrap idempotente
    const { nombre, password } = await body<{ nombre: string; password: string }>(req)
    if (!nombre || !password) throw new PachaError('Usuario y contraseña requeridos')

    const usuario = await db.usuario.findUnique({ where: { nombre: nombre.trim() } })
    if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
      throw new PachaError('Usuario o contraseña incorrectos', 401)
    }

    await setSessionCookie(usuario.id)
    return ok({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol })
  } catch (e) {
    return error(e)
  }
}
