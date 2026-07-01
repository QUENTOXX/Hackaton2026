'use client'

// Liste des participants d'une salle, avec badge « présentateur ».
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown } from 'lucide-react'
import type { Participant } from '@/lib/realtime/socket-events'

export function ParticipantsList({
  participants,
  currentUserId,
}: {
  participants: Participant[]
  currentUserId: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Participants
          <Badge variant="secondary" className="ml-auto">
            {participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {participants.length === 0 && (
          <p className="text-sm text-muted-foreground">Personne pour l’instant…</p>
        )}
        {participants.map((p) => (
          <div
            key={p.userId}
            className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              {p.role === 'host' && <Crown className="h-4 w-4 text-yellow-400" />}
              <span className={p.userId === currentUserId ? 'font-semibold' : ''}>
                {p.name}
                {p.userId === currentUserId && ' (vous)'}
              </span>
            </span>
            {p.role === 'host' && <Badge variant="outline">présentateur</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
