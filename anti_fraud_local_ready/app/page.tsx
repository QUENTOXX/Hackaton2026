// Page d'accueil : redirige selon l'état de connexion.
//  - non connecté      -> /login
//  - administrateur     -> /dashboard (centre de contrôle)
//  - utilisateur simple -> /protected (page protégée)
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const role = (session.user as any).role
  if (role === 'admin') redirect('/dashboard')
  redirect('/protected')
}
