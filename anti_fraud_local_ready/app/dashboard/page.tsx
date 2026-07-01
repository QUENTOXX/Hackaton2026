// Tableau de bord (centre de contrôle de sécurité).
// Composant serveur : réservé aux administrateurs.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as any
  // Seuls les administrateurs accèdent au centre de contrôle
  if (user.role !== 'admin') redirect('/protected')

  return <DashboardClient email={user.email ?? ''} name={user.name ?? null} />
}
