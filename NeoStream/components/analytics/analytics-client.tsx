'use client'

// =====================================================================
// Espace « Analytics » (module Data) — page admin distincte du centre de
// sécurité SentinelGuard. Marque NeoStream ; analyse d'audience & rétention.
// =====================================================================
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnalyticsPanel } from '@/components/analytics/analytics-panel'
import { LineChart, ShieldCheck, Radio, LogOut } from 'lucide-react'

export function AnalyticsClient({ email, name }: { email: string; name: string | null }) {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute inset-0 cyber-grid opacity-30" />

      {/* En-tête : marque NeoStream + libellé « Analytics » */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge variant="secondary" className="hidden gap-1 sm:flex">
              <LineChart className="h-3 w-3" /> Analytics
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard"><ShieldCheck className="mr-2 h-4 w-4" /> Sécurité</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/watch"><Radio className="mr-2 h-4 w-4" /> Watch Together</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Analyse d'audience &amp; prédiction de rétention — connecté en tant que {name || email}.
          </p>
        </div>

        <AnalyticsPanel />
      </div>
    </main>
  )
}
