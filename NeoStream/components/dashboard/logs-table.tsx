'use client'

// Journal détaillé de tous les événements de sécurité, avec filtre par type.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { THREAT_LABELS, THREAT_ICONS, SEVERITY_LABELS, SEVERITY_STYLES, formatDateFr } from '@/lib/labels'
import type { LogItem } from './alerts-feed'
import { FileText, Info } from 'lucide-react'

const FILTERS = ['ALL', 'SIMULTANEOUS_LOGIN', 'VPN_PROXY', 'SCREENSHOT_ATTEMPT', 'BLOCKED_IP', 'LOGIN', 'WATCH']

export function LogsTable({
  logs, filter, onFilter,
}: {
  logs: LogItem[]
  filter: string
  onFilter: (f: string) => void
}) {
  const list = logs ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Journal des événements</CardTitle>
        <CardDescription>Historique complet des événements de sécurité.</CardDescription>
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
