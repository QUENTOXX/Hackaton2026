'use client'

// Fournit le contexte d'authentification (NextAuth) à toute l'application.
// Indispensable pour utiliser useSession / signIn / signOut côté client.
import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
