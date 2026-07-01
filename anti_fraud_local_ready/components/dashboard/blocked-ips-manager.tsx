'use client'

// Gestion des IP bloquées : ajout manuel + déblocage.
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDateFr } from '@/lib/labels'
import { Ban, Plus, Unlock, ShieldX } from 'lucide-react'

export interface BlockedIpItem {
  id: string
  ipAddress: string
  reason: string | null
  blockedBy: string | null
  createdAt: string
}

export function BlockedIpsManager({
  blockedIps, onBlock, onUnblock,
}: {
  blockedIps: BlockedIpItem[]
  onBlock: (ip: string, reason: string) => void
  onUnblock: (ip: string) => void
}) {
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const list = blockedIps ?? []

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ip.trim()) return
    onBlock(ip.trim(), reason.trim() || 'Bloquée manuellement')
    setIp(''); setReason('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldX className="h-4 w-4 text-primary" /> Adresses IP bloquées</CardTitle>
        <CardDescription>Bloquez ou débloquez manuellement des adresses IP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input placeholder="Adresse IP (ex : 45.83.91.10)" value={ip} onChange={(e) => setIp(e.target.value)} className="max-w-[220px] flex-1" />
          <Input placeholder="Raison (optionnel)" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-[220px] flex-1" />
          <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Bloquer</Button>
        </form>

        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune IP bloquée.</p>
        ) : (
          <div className="space-y-2">
            {list.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-400" />
                    <span className="font-mono font-medium">{b.ipAddress}</span>
                    <Badge variant="secondary">{b.blockedBy === 'auto' ? 'Automatique' : 'Manuel'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.reason ?? '—'} · {formatDateFr(b.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onUnblock(b.ipAddress)}>
                  <Unlock className="mr-2 h-3.5 w-3.5" /> Débloquer
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
