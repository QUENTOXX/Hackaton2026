'use client'

// =====================================================================
// Historique des diffusions terminées : durée de diffusion + détail des
// participants (arrivée, temps de présence).
// =====================================================================
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Clock, Crown, RefreshCw, Users } from 'lucide-react'

interface HistoryParticipant {
  name: string
  role: string
  joinedAt: string
  leftAt: string | null
  presentSec: number | null
}
interface HistoryRoom {
  code: string
  name: string
  hostName: string
  createdAt: string
  endedAt: string | null
  broadcastSec: number | null
  participants: HistoryParticipant[]
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function HistoryClient() {
  const [history, setHistory] = useState<HistoryRoom[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/rooms/history')
      const data = await res.json()
      setHistory(data?.history ?? [])
    } catch {
      /* silencieux */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/watch"><ArrowLeft className="mr-2 h-4 w-4" /> Salles</Link>
            </Button>
            <Logo />
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Historique des diffusions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessions terminées, avec durée de diffusion et présence des participants.
        </p>

        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!loading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune diffusion terminée pour le moment.</p>
          )}

          {history.map((r) => (
            <Card key={r.code + r.createdAt}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                  <span>{r.name}</span>
                  <Badge variant="outline" className="font-mono">{r.code}</Badge>
                  <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                    <Crown className="h-3.5 w-3.5 text-yellow-400" /> {r.hostName}
                  </span>
                  <Badge variant="secondary" className="ml-auto gap-1">
                    <Clock className="h-3 w-3" /> {fmtDuration(r.broadcastSec)}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {fmtDateTime(r.createdAt)}
                  {r.endedAt && ` → ${fmtDateTime(r.endedAt)}`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  {r.participants.length} participation(s)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                        <th className="py-1.5 pr-4 font-medium">Participant</th>
                        <th className="py-1.5 pr-4 font-medium">Rôle</th>
                        <th className="py-1.5 pr-4 font-medium">Arrivée</th>
                        <th className="py-1.5 pr-4 font-medium">Présence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.participants.map((p, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="py-1.5 pr-4">{p.name}</td>
                          <td className="py-1.5 pr-4">
                            {p.role === 'host' ? (
                              <Badge className="gap-1 bg-yellow-500/20 text-yellow-300"><Crown className="h-3 w-3" /> hôte</Badge>
                            ) : (
                              <span className="text-muted-foreground">invité</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{fmtDateTime(p.joinedAt)}</td>
                          <td className="py-1.5 pr-4 font-mono">{fmtDuration(p.presentSec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
