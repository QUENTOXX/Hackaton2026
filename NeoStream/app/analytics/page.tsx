// Espace Analytics (module Data) — réservé aux administrateurs.
// Composant serveur : vérifie l'authentification et le rôle admin.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AnalyticsClient } from '@/components/analytics/analytics-client'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics — NeoStream',
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as any
  // Analyse d'audience = espace admin (comme le centre de sécurité).
  if (user.role !== 'admin') redirect('/protected')

  return <AnalyticsClient email={user.email ?? ''} name={user.name ?? null} />
}
