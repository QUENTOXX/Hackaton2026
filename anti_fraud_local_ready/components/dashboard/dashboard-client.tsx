'use client'

// =====================================================================
// Centre de contrôle de sécurité (composant client).
// Rafraîchit les données toutes les 5 secondes (temps réel par "polling").
// =====================================================================
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatCards, type Stats } from './stat-cards'
import { AlertsFeed, type LogItem } from './alerts-feed'
import { SessionsTable, type SessionItem } from './sessions-table'
import { BlockedIpsManager, type BlockedIpItem } from './blocked-ips-manager'
import { LogsTable } from './logs-table'
import { SimulatorPanel } from './simulator-panel'
import { THREAT_LABELS } from '@/lib/labels'
import { LogOut, Lock, PieChart as PieIcon, BarChart3, RefreshCw, Radio } from 'lucide-react'

// Les graphiques sont chargés côté client uniquement (ssr:false)
const ThreatPieChart = dynamic(() => import('./charts').then((m) => m.ThreatPieChart), {
  ssr: false,
  loading: () => <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Chargement du graphique…</div>,
})
const TimelineChart = dynamic(() => import('./charts').then((m) => m.TimelineChart), {
  ssr: false,
  loading: () => <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Chargement du graphique…</div>,
})

interface StatsFull extends Stats {
  byType: { type: string; count: number }[]
  timeline: { day: string; count: number }[]
}

export function DashboardClient({ email, name }: { email: string; name: string | null }) {
  const [stats, setStats] = useState<StatsFull | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIpItem[]>([])
  const [filter, setFilter] = useState('ALL')
  const [simBusy, setSimBusy] = useState(false)
  const lastThreatId = useRef<string | null>(null)
  const firstLoad = useRef(true)

  // --- Récupère toutes les données ---
  const fetchAll = useCallback(async (currentFilter: string) => {
    try {
      const [sRes, lRes, seRes, bRes] = await Promise.all([
        fetch('/api/security/stats', { cache: 'no-store' }),
        fetch(`/api/security/logs?limit=80&type=${currentFilter}`, { cache: 'no-store' }),
        fetch('/api/security/sessions', { cache: 'no-store' }),
        fetch('/api/security/blocked-ips', { cache: 'no-store' }),
      ])
      const sData = await sRes.json().catch(() => null)
      const lData = await lRes.json().catch(() => ({ logs: [] }))
      const seData = await seRes.json().catch(() => ({ sessions: [] }))
      const bData = await bRes.json().catch(() => ({ blockedIps: [] }))

      if (sData) setStats(sData)
      const newLogs: LogItem[] = lData?.logs ?? []
      setLogs(newLogs)
      setSessions(seData?.sessions ?? [])
      setBlockedIps(bData?.blockedIps ?? [])

      // Notification en direct si une nouvelle menace apparaît
      const topThreat = newLogs.find((l) => l.type !== 'LOGIN' && l.type !== 'INFO')
      if (topThreat) {
        if (!firstLoad.current && topThreat.id !== lastThreatId.current) {
          toast.error(`Nouvelle menace : ${THREAT_LABELS[topThreat.type] ?? topThreat.type}`, {
            description: topThreat.message,
          })
        }
        lastThreatId.current = topThreat.id
      }
      firstLoad.current = false
    } catch {
      // pas de plantage
    }
  }, [])

  // Rafraîchissement automatique toutes les 5 s
  useEffect(() => {
    fetchAll(filter)
    const id = setInterval(() => fetchAll(filter), 5000)
    return () => clearInterval(id)
  }, [fetchAll, filter])

  // --- Actions ---
  const handleBlock = useCallback(async (ip: string, reason = 'Bloquée manuellement') => {
    try {
      const res = await fetch('/api/security/blocked-ips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: ip, reason }),
      })
      if (res.ok) { toast.success(`IP ${ip} bloquée.`); fetchAll(filter) }
      else toast.error('Impossible de bloquer cette IP.')
    } catch { toast.error('Erreur réseau.') }
  }, [fetchAll, filter])

  const handleUnblock = useCallback(async (ip: string) => {
    try {
      const res = await fetch(`/api/security/blocked-ips?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' })
      if (res.ok) { toast.success(`IP ${ip} débloquée.`); fetchAll(filter) }
      else toast.error('Impossible de débloquer cette IP.')
    } catch { toast.error('Erreur réseau.') }
  }, [fetchAll, filter])

  const handleSimulate = useCallback(async (scenario: string) => {
    setSimBusy(true)
    try {
      const res = await fetch('/api/security/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) toast.success(data?.message ?? 'Scénario simulé.')
      else toast.error('Échec de la simulation.')
      await fetchAll(filter)
    } catch { toast.error('Erreur réseau.') }
    finally { setSimBusy(false) }
  }, [fetchAll, filter])

  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute inset-0 cyber-grid opacity-30" />

      {/* En-tête fixe */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:flex">
              <RefreshCw className="h-3 w-3" /> Temps réel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/watch"><Radio className="mr-2 h-4 w-4" /> Watch Together</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/protected"><Lock className="mr-2 h-4 w-4" /> Page protégée</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Centre de contrôle</h1>
          <p className="text-sm text-muted-foreground">
            Surveillance anti-fraude en temps réel — connecté en tant que {name || email}.
          </p>
        </div>

        {/* Statistiques */}
        <StatCards stats={stats} />

        {/* Simulateur */}
        <div className="mt-6">
          <SimulatorPanel onSimulate={handleSimulate} busy={simBusy} />
        </div>

        {/* Onglets */}
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="sessions">Connexions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="logs">Journal</TabsTrigger>
            <TabsTrigger value="blocked">IP bloquées ({blockedIps.length})</TabsTrigger>
          </TabsList>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><PieIcon className="h-4 w-4 text-primary" /> Répartition des menaces</CardTitle>
                  <CardDescription>Par type de menace détectée.</CardDescription>
                </CardHeader>
                <CardContent><ThreatPieChart data={stats?.byType ?? []} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Activité (7 jours)</CardTitle>
                  <CardDescription>Nombre de menaces détectées par jour.</CardDescription>
                </CardHeader>
                <CardContent><TimelineChart data={stats?.timeline ?? []} /></CardContent>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AlertsFeed logs={logs} />
              <SessionsTable sessions={sessions} onBlock={(ip) => handleBlock(ip)} />
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <SessionsTable sessions={sessions} onBlock={(ip) => handleBlock(ip)} />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <LogsTable logs={logs} filter={filter} onFilter={setFilter} />
          </TabsContent>

          <TabsContent value="blocked" className="mt-4">
            <BlockedIpsManager blockedIps={blockedIps} onBlock={handleBlock} onUnblock={handleUnblock} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
