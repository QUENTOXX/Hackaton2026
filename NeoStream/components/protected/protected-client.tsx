'use client'

// =====================================================================
// Contenu de la page protégée (composant client).
//  - enregistre la session et lance les détections (VPN, IP bloquée, simultanées)
//  - surveille les tentatives de capture d'écran via des événements clavier
// =====================================================================
import { useEffect, useState, useCallback, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useScreenshotGuard } from '@/hooks/use-screenshot-guard'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck, Camera, Wifi, AlertTriangle, LogOut, LayoutDashboard,
  Lock, MapPin, Server, Eye, FileText, Radio,
} from 'lucide-react'

interface Reputation {
  ip: string
  location: string
  isp: string
  proxy: boolean
  hosting: boolean
  isSuspicious: boolean
  reason: string
}
interface Alert { type: string; severity: string; message: string }

export function ProtectedClient({ email, name, role }: { email: string; name: string | null; role: string }) {
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [blocked, setBlocked] = useState(false)
  const [screenshotCount, setScreenshotCount] = useState(0)
  const [checking, setChecking] = useState(true)
  const reported = useRef(false)

  // --- Enregistre la session et récupère l'analyse de sécurité ---
  const registerSession = useCallback(async (simulatedIp?: string) => {
    setChecking(true)
    try {
      const res = await fetch('/api/security/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulatedIp ? { simulatedIp } : {}),
      })
      const data = await res.json().catch(() => ({}))
      setReputation(data?.reputation ?? null)
      setAlerts(data?.alerts ?? [])
      setBlocked(Boolean(data?.blocked))
      if (data?.alerts?.length) {
        data.alerts.forEach((a: Alert) => toast.warning(a?.message ?? 'Alerte de sécurité'))
      }
    } catch {
      // pas de plantage en cas d'erreur réseau
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    registerSession()
  }, [registerSession])

  // --- Détection des tentatives de capture d'écran ---
  const reportScreenshot = useCallback(async (method: string) => {
    setScreenshotCount((c) => c + 1)
    toast.error(`Tentative de capture d'écran détectée (${method}) — événement enregistré.`)
    try {
      await fetch('/api/security/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
    } catch {}
  }, [])

  // Surveillance des captures d'écran (logique partagée avec Watch Together).
  useScreenshotGuard(reportScreenshot)

  const hasThreat = alerts.length > 0 || blocked

  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute inset-0 cyber-grid opacity-40" />

      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/watch"><Radio className="mr-2 h-4 w-4" /> Watch Together</Link>
            </Button>
            {role === 'admin' && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 glow-pink">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Espace protégé</h1>
            <p className="text-sm text-muted-foreground">
              Bonjour {name || email} — cette page est surveillée par le système anti-fraude.
            </p>
          </div>
        </div>

        {/* Bannière d'état de sécurité */}
        <div className="mt-6">
          {blocked ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-semibold text-red-300">Accès restreint</p>
                <p className="text-sm text-red-200/80">Votre adresse IP est bloquée par le système de sécurité.</p>
              </div>
            </div>
          ) : hasThreat ? (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
                  <div>
                    <p className="font-semibold text-orange-300">Activité suspecte détectée</p>
                    <p className="text-sm text-orange-200/80">{a?.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">Connexion sécurisée</p>
                <p className="text-sm text-emerald-200/80">
                  {checking ? 'Analyse de votre connexion en cours…' : 'Aucune menace détectée sur votre session.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cartes d'information */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Votre connexion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-mono text-foreground">{reputation?.ip ?? '—'}</p>
              <p className="text-muted-foreground">{reputation?.location ?? 'Localisation en cours…'}</p>
              <p className="text-xs text-muted-foreground">{reputation?.isp ?? ''}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Wifi className="h-4 w-4 text-primary" /> Réputation IP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reputation?.isSuspicious ? (
                <Badge variant="destructive">Suspecte</Badge>
              ) : (
                <Badge variant="secondary">Normale</Badge>
              )}
              <p className="text-xs text-muted-foreground">{reputation?.reason ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4 text-primary" /> Captures bloquées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-bold text-primary">{screenshotCount}</p>
              <p className="text-xs text-muted-foreground">tentatives détectées sur cette page</p>
            </CardContent>
          </Card>
        </div>

        {/* Contenu confidentiel démo */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" /> Document confidentiel (démo)</CardTitle>
            <CardDescription>Essayez d'appuyer sur la touche « Impr. écran » : une alerte sera déclenchée.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Ce contenu simule des informations sensibles à protéger.</p>
            <div className="rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed">
              Référence dossier : SG-2026-00471<br />
              Clé d'accès : ••••••••••••••••<br />
              Statut : Confidentiel — diffusion interdite
            </div>
          </CardContent>
        </Card>

        {/* Outils de simulation (pour la démo) */}
        <Card className="mt-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Server className="h-5 w-5 text-primary" /> Simulateur (démo)</CardTitle>
            <CardDescription>Testez la détection en simulant une connexion depuis une autre adresse IP.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => registerSession('45.83.91.10')}>
              <Wifi className="mr-2 h-4 w-4" /> Simuler une connexion VPN
            </Button>
            <Button variant="outline" onClick={() => registerSession('104.16.0.1')}>
              <MapPin className="mr-2 h-4 w-4" /> Simuler un autre pays
            </Button>
            <Button variant="outline" onClick={() => registerSession()}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Revenir à ma connexion réelle
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
