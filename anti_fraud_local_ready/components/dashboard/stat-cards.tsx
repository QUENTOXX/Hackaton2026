'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AnimatedNumber } from './animated-number'
import { ShieldAlert, Activity, Ban, AlertOctagon, type LucideIcon } from 'lucide-react'

export interface Stats {
  totalThreats: number
  activeSessions: number
  blockedIps: number
  criticalCount: number
}

function StatCard({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: number; accent: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-mono text-3xl font-bold tracking-tight">
            <AnimatedNumber value={value ?? 0} />
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatCards({ stats }: { stats: Stats | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={ShieldAlert} label="Menaces détectées" value={stats?.totalThreats ?? 0} accent="bg-primary/15 text-primary" />
      <StatCard icon={Activity} label="Connexions actives" value={stats?.activeSessions ?? 0} accent="bg-cyan-500/15 text-cyan-400" />
      <StatCard icon={AlertOctagon} label="Alertes critiques" value={stats?.criticalCount ?? 0} accent="bg-red-500/15 text-red-400" />
      <StatCard icon={Ban} label="IP bloquées" value={stats?.blockedIps ?? 0} accent="bg-amber-500/15 text-amber-400" />
    </div>
  )
}
