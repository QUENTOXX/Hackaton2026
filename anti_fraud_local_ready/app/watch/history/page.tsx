// Historique des diffusions — page serveur (auth obligatoire).
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { HistoryClient } from '@/components/watch/history-client'

export default async function WatchHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <HistoryClient />
}
