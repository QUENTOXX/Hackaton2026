'use client'

// Gestion de la liste blanche d'IP : ajout + retrait.
// Une IP autorisée est exemptée du pare-feu et du verrouillage anti-brute-force.
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateFr } from '@/lib/labels'
import { ShieldCheck, Plus, X, CheckCircle2 } from 'lucide-react'

export interface AllowedIpItem {
  id: string
  ipAddress: string
  reason: string | null
  createdAt: string
}

export function AllowedIpsManager({
  allowedIps, onAllow, onRemove,
}: {
  allowedIps: AllowedIpItem[]
  onAllow: (ip: string, reason: string) => void
  onRemove: (ip: string) => void
}) {
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const list = allowedIps ?? []

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ip.trim()) return
    onAllow(ip.trim(), reason.trim() || 'IP de confiance')
    setIp(''); setReason('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Liste blanche d'IP</CardTitle>
        <CardDescription>Les IP de confiance sont exemptées du pare-feu et du verrouillage anti-brute-force.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input placeholder="Adresse IP (ex : 51.158.1.1)" value={ip} onChange={(e) => setIp(e.target.value)} className="max-w-[220px] flex-1" />
          <Input placeholder="Raison (ex : poste de démo)" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-[220px] flex-1" />
          <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Autoriser</Button>
        </form>

        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune IP en liste blanche.</p>
        ) : (
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono font-medium">{a.ipAddress}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.reason ?? '—'} · {formatDateFr(a.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemove(a.ipAddress)}>
                  <X className="mr-2 h-3.5 w-3.5" /> Retirer
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
