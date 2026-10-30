// Autenticación PACHA: sesiones con cookie firmada (HMAC) + scrypt para contraseñas
// Nota: además de la cookie, se acepta el token por cabecera `x-pacha-session`.
// Esto es necesario cuando la app corre dentro de un iframe multi-sitio (panel de
// vista previa), donde el navegador bloquea las cookies SameSite=Lax.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'
import { PachaError } from './tipos'

const SECRET = process.env.PACHA_SECRET || 'pacha-simulador-markestrat-2024'
export const SESSION_COOKIE = 'pacha_session'
export const SESSION_HEADER = 'x-pacha-session'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = scryptSync(password, salt, 32)
  const orig = Buffer.from(hash, 'hex')
  return orig.length === test.length && timingSafeEqual(test, orig)
}

export function crearToken(userId: string): string {
  const sig = createHmac('sha256', SECRET).update(userId).digest('hex').slice(0, 32)
  return `${userId}.${sig}`
}

export function leerToken(token: string | undefined | null): string | null {
  if (!token) return null
  const [userId, sig] = token.split('.')
  if (!userId || !sig) return null
  const esperada = createHmac('sha256', SECRET).update(userId).digest('hex').slice(0, 32)
  return sig === esperada ? userId : null
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, crearToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export interface UsuarioSesion {
  id: string
  nombre: string
  rol: string
}

/** Lee el token de sesión: primero la cabecera (contexto iframe), luego la cookie. */
export async function leerTokenSesion(): Promise<string | null> {
  try {
    const h = await headers()
    const delHeader = h.get(SESSION_HEADER)
    if (delHeader) return delHeader
  } catch {
    // fuera de un contexto de petición: ignorar
  }
  try {
    const jar = await cookies()
    return jar.get(SESSION_COOKIE)?.value ?? null
  } catch {
    return null
  }
}

export async function getUsuarioActual(): Promise<UsuarioSesion | null> {
  const userId = leerToken(await leerTokenSesion())
  if (!userId) return null
  const u = await db.usuario.findUnique({ where: { id: userId } })
  if (!u) return null
  return { id: u.id, nombre: u.nombre, rol: u.rol }
}

export async function requireRol(...roles: string[]): Promise<UsuarioSesion> {
  const u = await getUsuarioActual()
  if (!u) throw new PachaError('No autenticado', 401)
  if (roles.length > 0 && !roles.includes(u.rol)) throw new PachaError('Sin permisos para esta acción', 403)
  return u
}
