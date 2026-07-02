'use client'

// Liste des participants d'une salle : badge présentateur, badge co-présentateur,
// et (pour l'hôte) un bouton pour accorder/retirer les droits de pilotage.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Crown, Gamepad2, UserCheck } from 'lucide-react'
import type { Participant } from '@/lib/realtime/socket-events'

export function ParticipantsList({
  participants,
  currentUserId,
  controllers = [],
  canManage = false,
  onToggleControl,
}: {
  participants: Participant[]
  currentUserId: string
  controllers?: string[]
  canManage?: boolean
  onToggleControl?: (userId: string, next: boolean) => void
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
        {participants.map((p) => {
          const isHost = p.role === 'host'
          const isCoPresenter = controllers.includes(p.userId)
          return (
            <div
              key={p.userId}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                {isHost && <Crown className="h-4 w-4 shrink-0 text-yellow-400" />}
                <span className={`truncate ${p.userId === currentUserId ? 'font-semibold' : ''}`}>
                  {p.name}
                  {p.userId === currentUserId && ' (vous)'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {isHost ? (
                  <Badge variant="outline">présentateur</Badge>
                ) : isCoPresenter ? (
                  <Badge className="gap-1 bg-emerald-500/20 text-emerald-300"><Gamepad2 className="h-3 w-3" /> co-présentateur</Badge>
                ) : null}
                {/* L'hôte peut donner/retirer les droits de pilotage aux invités */}
                {canManage && !isHost && onToggleControl && (
                  <Button
                    size="xs"
                    variant={isCoPresenter ? 'secondary' : 'outline'}
                    onClick={() => onToggleControl(p.userId, !isCoPresenter)}
                    title={isCoPresenter ? 'Retirer les droits de pilotage' : 'Autoriser à piloter'}
                  >
                    <UserCheck className="mr-1 h-3.5 w-3.5" />
                    {isCoPresenter ? 'Retirer' : 'Autoriser'}
                  </Button>
                )}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
