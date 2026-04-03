import { verifyToken } from '@clerk/backend'

/** Valida Bearer JWT de Clerk y devuelve el `sub` (user id). */
export async function getClerkUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY no configurada')
    return null
  }
  try {
    const payload = await verifyToken(token, { secretKey })
    const sub = payload?.sub
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}
