import { db } from '@/lib/db'
import { error, ok, body } from '@/lib/pacha/api-helpers'
import { crearToken, setSessionCookie, verifyPassword } from '@/lib/pacha/auth'
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
    // Se devuelve también el token para que el cliente pueda mantener la sesión
    // por cabecera cuando las cookies están bloqueadas (ej: iframe de vista previa)
    return ok({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, token: crearToken(usuario.id) })
  } catch (e) {
    return error(e)
  }
}
