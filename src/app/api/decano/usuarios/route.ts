import { error, ok, body } from '@/lib/pacha/api-helpers'
import { hashPassword, requireRol } from '@/lib/pacha/auth'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'

/** Decano: crea usuarios, resetea contraseñas o elimina alumnos y profesores. */
export async function POST(req: Request) {
  try {
    const actual = await requireRol('DECANO')
    const datos = await body<{
      accion: 'crear' | 'reset' | 'eliminar'
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

    if (datos.accion === 'eliminar') {
      if (!datos.usuarioId) throw new PachaError('Falta el usuario')
      const objetivo = await db.usuario.findUnique({
        where: { id: datos.usuarioId },
        include: { membresias: true, industriasProfesor: true },
      })
      if (!objetivo) throw new PachaError('Usuario no encontrado', 404)
      if (objetivo.rol === 'DECANO') throw new PachaError('No se puede eliminar a un administrador')
      if (objetivo.id === actual.id) throw new PachaError('No puedes eliminarte a ti mismo')
      if (objetivo.industriasProfesor.length > 0) {
        throw new PachaError(
          `Este profesor tiene ${objetivo.industriasProfesor.length} simulación(es) a su cargo. Elímínalas primero.`
        )
      }

      // Sanciones que este usuario registró: las auditorías se conservan, así que
      // si registró alguna no se puede borrar sin perder el registro.
      const registradas = await db.penalizacion.count({ where: { registradaPorId: objetivo.id } })
      if (registradas > 0) {
        throw new PachaError(
          'Este usuario registró sanciones en el historial del comité; no se puede eliminar sin perder esa auditoría.'
        )
      }

      // Borradores enviados: queda el contenido, sin autor
      await db.borradorArea.updateMany({ where: { enviadoPorId: objetivo.id }, data: { enviadoPorId: null } })
      await db.penalizacion.deleteMany({ where: { usuarioId: objetivo.id } })
      await db.membresia.deleteMany({ where: { usuarioId: objetivo.id } })
      await db.usuario.delete({ where: { id: objetivo.id } })
      return ok({ ok: true, nombre: objetivo.nombre })
    }

    throw new PachaError('Acción inválida')
  } catch (e) {
    return error(e)
  }
}
