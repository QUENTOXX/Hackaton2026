// Lobby Watch Together — page serveur (auth obligatoire).
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { WatchLobby } from '@/components/watch/watch-lobby'

export default async function WatchPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <WatchLobby />
}
