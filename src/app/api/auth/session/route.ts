import { getUsuarioActual } from '@/lib/pacha/auth'
import { error, ok } from '@/lib/pacha/api-helpers'
import { seedSistema } from '@/lib/pacha/seed'

export async function GET() {
  try {
    await seedSistema()
    const usuario = await getUsuarioActual()
    return ok({ usuario })
  } catch (e) {
    return error(e)
  }
}
