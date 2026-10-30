import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PachaError } from '@/lib/pacha/tipos'

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data)
}

export function error(e: unknown) {
  if (e instanceof PachaError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('[PACHA] Error interno:', e)
  const msg = e instanceof Error ? e.message : 'Error interno del servidor'
  return NextResponse.json({ error: msg }, { status: 500 })
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new PachaError('Cuerpo de la petición inválido')
  }
}

export { db }
