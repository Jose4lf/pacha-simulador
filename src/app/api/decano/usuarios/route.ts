import { error, ok, body } from '@/lib/pacha/api-helpers'
import { hashPassword, requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'

/** Decano: crea usuarios o resetea contraseñas. */
export async function POST(req: Request) {
  try {
    await requireRol('DECANO')
    const datos = await body<{
      accion: 'crear' | 'reset'
      nombre?: string
      password?: string
      rol?: string
      usuarioId?: string
      nueva?: string
    }>(req)

    if (datos.accion === 'crear') {
      const nombre = (datos.nombre ?? '').trim().toLowerCase()
      const password = datos.password ?? ''
      const rol = datos.rol ?? 'ALUMNO'
      if (!nombre) throw new PachaError('El usuario necesita un nombre')
      if (password.length < 3) throw new PachaError('La contraseña debe tener al menos 3 caracteres')
      if (!['ALUMNO', 'PROFESOR', 'DECANO'].includes(rol)) throw new PachaError('Rol inválido')
      const existe = await db.usuario.findUnique({ where: { nombre } })
      if (existe) throw new PachaError('Ese nombre de usuario ya existe')
      await db.usuario.create({ data: { nombre, passwordHash: hashPassword(password), rol } })
      return ok({ ok: true })
    }

    if (datos.accion === 'reset') {
      if (!datos.usuarioId) throw new PachaError('Falta el usuario')
      const nueva = datos.nueva && datos.nueva.length >= 3 ? datos.nueva : '321'
      await db.usuario.update({
        where: { id: datos.usuarioId },
        data: { passwordHash: hashPassword(nueva) },
      })
      return ok({ ok: true, nueva })
    }

    throw new PachaError('Acción inválida')
  } catch (e) {
    return error(e)
  }
}
