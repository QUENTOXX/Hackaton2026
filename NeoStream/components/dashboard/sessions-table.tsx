'use client'

// Tableau des connexions actives, avec possibilité de bloquer l'IP.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateFr } from '@/lib/labels'
import { MapPin, Ban, Monitor, AlertTriangle, Users } from 'lucide-react'

export interface SessionItem {
  id: string
  ipAddress: string
  location: string | null
  latitude: number | null
  longitude: number | null
  isFlagged: boolean
  device: string | null
  userEmail: string
  userName: string | null
  createdAt: string
  lastSeen: string
}

export function SessionsTable({ sessions, onBlock }: { sessions: SessionItem[]; onBlock: (ip: string) => void }) {
  const list = sessions ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Connexions actives</CardTitle>
        <CardDescription>Sessions ouvertes actuellement, avec leur localisation.</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune connexion active.</p>
        ) : (
          <div className="space-y-2">
            {list.map((s) => (
              <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${s.isFlagged ? 'border-orange-500/40 bg-orange-500/5' : 'border-border bg-muted/30'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.userName || s.userEmail}</span>
                    {s.isFlagged && (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Suspecte</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{s.ipAddress}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location ?? 'Inconnue'}</span>
                    <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {s.device ?? 'Inconnu'}</span>
                    <span>Depuis {formatDateFr(s.createdAt)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onBlock(s.ipAddress)}>
                  <Ban className="mr-2 h-3.5 w-3.5" /> Bloquer l'IP
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
