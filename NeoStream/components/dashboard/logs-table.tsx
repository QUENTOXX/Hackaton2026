'use client'

// Journal détaillé de tous les événements de sécurité, avec filtre par type,
// séparation logs démo / logs réels, et purge des logs réels (confirmée).
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { THREAT_LABELS, THREAT_ICONS, SEVERITY_LABELS, SEVERITY_STYLES, formatDateFr } from '@/lib/labels'
import type { LogItem } from './alerts-feed'
import { FileText, Info, Trash2 } from 'lucide-react'

const FILTERS = ['ALL', 'SIMULTANEOUS_LOGIN', 'VPN_PROXY', 'SCREENSHOT_ATTEMPT', 'BLOCKED_IP', 'RATE_LIMIT', 'BRUTE_FORCE', 'GEO_VELOCITY', 'LOGIN', 'WATCH']

// Séparation démo / réel demandée pour la démo (deux "parties" du journal).
const SOURCES = [
  { id: 'all', label: 'Tous' },
  { id: 'real', label: 'Réels' },
  { id: 'demo', label: 'Démo' },
] as const
type Source = (typeof SOURCES)[number]['id']

export function LogsTable({
  logs, filter, onFilter, onPurge,
}: {
  logs: LogItem[]
  filter: string
  onFilter: (f: string) => void
  onPurge?: () => void
}) {
  const [source, setSource] = useState<Source>('all')
  const all = logs ?? []

  const list = useMemo(() => {
    if (source === 'demo') return all.filter((l) => l.simulated)
    if (source === 'real') return all.filter((l) => !l.simulated)
    return all
  }, [all, source])

  const realCount = all.filter((l) => !l.simulated).length
  const demoCount = all.length - realCount

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Journal des événements</CardTitle>
            <CardDescription>
              Historique complet — {realCount} réel{realCount > 1 ? 's' : ''} · {demoCount} démo.
            </CardDescription>
          </div>
          {onPurge && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="xs" variant="outline" className="text-red-300 hover:text-red-200">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Purger les logs réels
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Purger les logs réels ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprime définitivement les {realCount} événement{realCount > 1 ? 's' : ''} <strong>réel{realCount > 1 ? 's' : ''}</strong> du journal.
                    Les {demoCount} événement{demoCount > 1 ? 's' : ''} de <strong>démonstration</strong> sont conservés.
                    Pensez à exporter la télémétrie (CSV) au préalable si vous souhaitez la réutiliser.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onPurge}>Confirmer la purge</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Filtre par source : démo vs réel */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">Source :</span>
          {SOURCES.map((s) => (
            <Button key={s.id} size="xs" variant={source === s.id ? 'default' : 'outline'} onClick={() => setSource(s.id)}>
              {s.label}
            </Button>
          ))}
        </div>

        {/* Filtre par type (côté serveur) */}
        <div className="flex flex-wrap gap-2 pt-2">
          {FILTERS.map((f) => (
            <Button key={f} size="xs" variant={filter === f ? 'default' : 'outline'} onClick={() => onFilter(f)}>
              {f === 'ALL' ? 'Tout' : THREAT_LABELS[f] ?? f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-3">
          {list.length === 0 ? (
            <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Info className="h-6 w-6" /> Aucun événement.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {list.map((l) => {
                const Icon = THREAT_ICONS[l.type] ?? Info
                return (
                  <li key={l.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${SEVERITY_STYLES[l.severity] ?? SEVERITY_STYLES.low}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">{THREAT_LABELS[l.type] ?? l.type}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_STYLES[l.severity] ?? SEVERITY_STYLES.low}`}>{SEVERITY_LABELS[l.severity] ?? l.severity}</span>
                        {l.simulated ? (
                          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">Démo</span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/25">Réel</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm">{l.message}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {l.ipAddress ?? '—'} · {l.location ?? ''} · {formatDateFr(l.createdAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
