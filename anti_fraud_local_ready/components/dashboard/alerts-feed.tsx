'use client'

// Flux d'alertes en direct (les événements de menace les plus récents).
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { THREAT_LABELS, THREAT_ICONS, SEVERITY_LABELS, SEVERITY_STYLES, formatDateFr } from '@/lib/labels'
import { Radio, Info } from 'lucide-react'

export interface LogItem {
  id: string
  type: string
  severity: string
  message: string
  ipAddress: string | null
  location: string | null
  userEmail: string | null
  createdAt: string
}

export function AlertsFeed({ logs }: { logs: LogItem[] }) {
  // On ne garde que les vraies menaces pour le flux "en direct"
  const threats = (logs ?? []).filter((l) => l?.type !== 'LOGIN' && l?.type !== 'INFO')
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-2.5 w-2.5 items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-primary animate-live-pulse" />
          </span>
          <Radio className="h-4 w-4 text-primary" /> Alertes en direct
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-3">
          {threats.length === 0 ? (
            <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Info className="h-6 w-6" /> Aucune alerte pour le moment.
            </div>
          ) : (
            <ul className="space-y-2">
              {threats.map((l) => {
                const Icon = THREAT_ICONS[l.type] ?? Info
                return (
                  <li key={l.id} className={`flex items-start gap-3 rounded-lg border p-3 ${SEVERITY_STYLES[l.severity] ?? SEVERITY_STYLES.low}`}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide">{THREAT_LABELS[l.type] ?? l.type}</span>
                        <span className="shrink-0 text-[10px] font-medium opacity-80">{SEVERITY_LABELS[l.severity] ?? l.severity}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground/90">{l.message}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {l.ipAddress ?? '—'} · {formatDateFr(l.createdAt)}
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
