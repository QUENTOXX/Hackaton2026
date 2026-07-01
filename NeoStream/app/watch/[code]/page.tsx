// Salle Watch Together — page serveur (auth + résolution de la salle).
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { RoomClient } from '@/components/watch/room-client'

export default async function RoomPage({ params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const code = decodeURIComponent(params.code).toUpperCase()
  const user = session.user as { id: string; email?: string | null; name?: string | null }

  // La validation d'existence de la salle se fait au join Socket.io
  // (état temps réel) ; on passe juste le code et l'utilisateur courant.
  return (
    <RoomClient
      code={code}
      currentUserId={user.id}
      currentUserEmail={user.email ?? user.name ?? user.id}
    />
  )
}
