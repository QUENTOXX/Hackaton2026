// Vérifie qu'une requête provient d'un administrateur connecté.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  return (session?.user as any) ?? null
}

export async function requireAdmin() {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, status: 401, user: null }
  if (user.role !== 'admin') return { ok: false as const, status: 403, user }
  return { ok: true as const, status: 200, user }
}
