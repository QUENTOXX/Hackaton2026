'use client'

// =====================================================================
// Page de diagnostic J0 (TEMPORAIRE) — valide la chaîne temps réel :
//   navigateur -> Socket.io -> auth NextAuth -> ping/pong authentifié.
// À supprimer une fois le module Watch Together en place.
// Connexion requise (sinon le handshake renvoie UNAUTHENTICATED).
// =====================================================================
import { useState } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { EV, type PongPayload } from '@/lib/realtime/socket-events'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function WatchTestPage() {
  const { socket, connected, error } = useSocket()
  const [pong, setPong] = useState<PongPayload | null>(null)
  const [latency, setLatency] = useState<number | null>(null)

  function sendPing() {
    if (!socket) return
    const t0 = Date.now()
    socket.emit(EV.PING, { hello: 'world' }, (reply: PongPayload) => {
      setPong(reply)
      setLatency(Date.now() - t0)
    })
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Diagnostic temps réel (J0)
            {connected ? (
              <Badge variant="secondary">connecté</Badge>
            ) : (
              <Badge variant="destructive">déconnecté</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Valide la chaîne Socket.io + authentification NextAuth. Connexion requise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              Erreur de connexion : <span className="font-mono">{error}</span>
              {error.includes('UNAUTHENTICATED') && ' — connecte-toi d’abord via /login.'}
            </p>
          )}

          <Button onClick={sendPing} disabled={!connected}>
            Envoyer un ping authentifié
          </Button>

          {pong && (
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-semibold text-emerald-400">Pong reçu ✓ {latency != null && `(${latency} ms)`}</p>
              <p className="mt-2 text-muted-foreground">Utilisateur authentifié côté serveur :</p>
              <pre className="mt-1 overflow-x-auto font-mono text-xs">
                {JSON.stringify(pong.user, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
