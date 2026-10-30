import { clearSessionCookie } from '@/lib/pacha/auth'
import { error, ok } from '@/lib/pacha/api-helpers'

export async function POST() {
  try {
    await clearSessionCookie()
    return ok()
  } catch (e) {
    return error(e)
  }
}
