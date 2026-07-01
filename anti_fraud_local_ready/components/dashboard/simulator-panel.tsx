'use client'

// Panneau de simulation de menaces (pour la démonstration sans vrais appareils).
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Wifi, Camera, Ban } from 'lucide-react'

export function SimulatorPanel({ onSimulate, busy }: { onSimulate: (scenario: string) => void; busy: boolean }) {
  const actions = [
    { id: 'simultaneous', label: 'Connexions simultanées', icon: Users },
    { id: 'vpn', label: 'Connexion VPN / Proxy', icon: Wifi },
    { id: 'screenshot', label: "Capture d'écran", icon: Camera },
    { id: 'blocked', label: 'Accès IP bloquée', icon: Ban },
  ]
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Simulateur de menaces</CardTitle>
        <CardDescription>Générez des événements de test pour voir les détections en action.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Button key={a.id} variant="outline" disabled={busy} onClick={() => onSimulate(a.id)} className="justify-start">
            <a.icon className="mr-2 h-4 w-4 text-primary" /> {a.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
