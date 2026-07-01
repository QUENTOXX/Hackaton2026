// Page protégée côté utilisateur.
// Composant serveur : vérifie la connexion puis affiche le contenu client.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ProtectedClient } from '@/components/protected/protected-client'

export const dynamic = 'force-dynamic'

export default async function ProtectedPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as any
  return (
    <ProtectedClient
      email={user.email ?? ''}
      name={user.name ?? null}
      role={user.role ?? 'user'}
    />
  )
}
