'use client'

// =====================================================================
// Logique d'une salle Watch Together (côté client).
//  - rejoint la salle via Socket.io et récupère l'état courant
//  - HÔTE   : ses actions natives émettent presenter:* vers le serveur
//  - INVITÉ : applique les sync:* reçus sur son lecteur (verrouillé)
//  - gère le transfert d'hôte (déconnexion / reconnexion / promotion)
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSocket } from '@/hooks/use-socket'
import { EV, type JoinAck, type Participant, type RoomState } from '@/lib/realtime/socket-events'
import { HlsPlayer } from '@/components/watch/hls-player'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { getYouTubeId, type PlayerHandle } from '@/components/watch/player-types'
import { ParticipantsList } from '@/components/watch/participants-list'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Crown, Radio, Wifi, WifiOff, PowerOff } from 'lucide-react'

export function RoomClient({ code, currentUserId }: { code: string; currentUserId: string }) {
  const router = useRouter()
  const { socket, connected, error } = useSocket()
  const playerRef = useRef<PlayerHandle>(null)

  const [room, setRoom] = useState<RoomState | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isHost, setIsHost] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [hostNotice, setHostNotice] = useState<string | null>(null)

  // Applique un état de lecture initial (join / join tardif).
  const applyInitial = useCallback((state: RoomState) => {
    // On attend un tick que le lecteur soit monté.
    setTimeout(() => {
      if (state.playback.state === 'playing') playerRef.current?.applyPlay(state.playback.positionSec)
      else playerRef.current?.applySeek(state.playback.positionSec)
    }, 200)
  }, [])

  useEffect(() => {
    if (!socket || !connected) return

    socket.emit(EV.ROOM_JOIN, { code }, (res: JoinAck) => {
      if (!res?.ok) {
        if (res?.error === 'ROOM_NOT_FOUND') setNotFound(true)
        return
      }
      setRoom(res.state)
      setParticipants(res.state.participants)
      setIsHost(res.state.isHost)
      applyInitial(res.state)
    })

    const onParticipants = (list: Participant[]) => setParticipants(list)
    const onPlay = ({ positionSec }: { positionSec: number }) => playerRef.current?.applyPlay(positionSec)
    const onPause = ({ positionSec }: { positionSec: number }) => playerRef.current?.applyPause(positionSec)
    const onSeek = ({ positionSec }: { positionSec: number }) => playerRef.current?.applySeek(positionSec)
    const onVideoChanged = ({ videoSrc }: { videoSrc: string }) =>
      setRoom((r) => (r ? { ...r, videoSrc } : r))
    const onHostDisconnected = () => setHostNotice('Présentateur déconnecté — reconnexion en cours…')
    const onHostReconnected = () => {
      setHostNotice(null)
      toast.success('Le présentateur est de retour.')
    }
    const onHostChanged = ({ hostId, hostName }: { hostId: string; hostName: string }) => {
      const iAmHost = hostId === currentUserId
      setIsHost(iAmHost)
      setRoom((r) => (r ? { ...r, hostId } : r))
      setHostNotice(null)
      toast.info(iAmHost ? 'Vous êtes désormais le présentateur.' : `${hostName} est désormais présentateur.`)
    }
    const onEnded = ({ reason }: { reason?: string } = {}) => {
      const msg =
        reason === 'inactivity'
          ? 'Salle fermée après 10 minutes d’inactivité.'
          : reason === 'empty'
            ? 'Salle fermée (plus aucun participant).'
            : 'Session terminée par le présentateur.'
      setHostNotice(msg)
      toast.warning(msg)
      setTimeout(() => router.push('/watch'), 1800)
    }

    socket.on(EV.ROOM_PARTICIPANTS, onParticipants)
    socket.on(EV.SYNC_PLAY, onPlay)
    socket.on(EV.SYNC_PAUSE, onPause)
    socket.on(EV.SYNC_SEEK, onSeek)
    socket.on(EV.ROOM_VIDEO_CHANGED, onVideoChanged)
    socket.on(EV.ROOM_HOST_DISCONNECTED, onHostDisconnected)
    socket.on(EV.ROOM_HOST_RECONNECTED, onHostReconnected)
    socket.on(EV.ROOM_HOST_CHANGED, onHostChanged)
    socket.on(EV.ROOM_ENDED, onEnded)

    return () => {
      socket.off(EV.ROOM_PARTICIPANTS, onParticipants)
      socket.off(EV.SYNC_PLAY, onPlay)
      socket.off(EV.SYNC_PAUSE, onPause)
      socket.off(EV.SYNC_SEEK, onSeek)
      socket.off(EV.ROOM_VIDEO_CHANGED, onVideoChanged)
      socket.off(EV.ROOM_HOST_DISCONNECTED, onHostDisconnected)
      socket.off(EV.ROOM_HOST_RECONNECTED, onHostReconnected)
      socket.off(EV.ROOM_HOST_CHANGED, onHostChanged)
      socket.off(EV.ROOM_ENDED, onEnded)
    }
  }, [socket, connected, code, currentUserId, applyInitial, router])

  // --- Actions de l'hôte (remontées par le lecteur) ---
  const onHostPlay = (positionSec: number) => socket?.emit(EV.PRESENTER_PLAY, { positionSec })
  const onHostPause = (positionSec: number) => socket?.emit(EV.PRESENTER_PAUSE, { positionSec })
  const onHostSeek = (positionSec: number) => socket?.emit(EV.PRESENTER_SEEK, { positionSec })

  function endSession() {
    if (!socket) return
    if (window.confirm('Terminer la session pour tous les participants ?')) {
      socket.emit(EV.PRESENTER_END)
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Salle introuvable</h1>
        <p className="mt-2 text-muted-foreground">Le code « {code} » n’existe pas ou la session est terminée.</p>
        <Button asChild className="mt-6">
          <Link href="/watch"><ArrowLeft className="mr-2 h-4 w-4" /> Retour aux salles</Link>
        </Button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/watch"><ArrowLeft className="mr-2 h-4 w-4" /> Salles</Link>
            </Button>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge variant="secondary" className="gap-1"><Wifi className="h-3 w-3" /> connecté</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> déconnecté</Badge>
            )}
            {isHost ? (
              <Badge className="gap-1 bg-yellow-500/20 text-yellow-300"><Crown className="h-3 w-3" /> présentateur</Badge>
            ) : (
              <Badge variant="outline">invité</Badge>
            )}
            {isHost && (
              <Button variant="destructive" size="sm" onClick={endSession}>
                <PowerOff className="mr-2 h-4 w-4" /> Terminer
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{room?.name ?? 'Chargement…'}</h1>
            <p className="text-sm text-muted-foreground">
              Code de la salle : <span className="font-mono font-semibold text-foreground">{code}</span>
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Connexion temps réel impossible : <span className="font-mono">{error}</span>
            {error.includes('UNAUTHENTICATED') && ' — reconnecte-toi.'}
          </p>
        )}

        {hostNotice && (
          <p className="mt-4 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-300">
            {hostNotice}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {room &&
              (() => {
                const ytId = getYouTubeId(room.videoSrc)
                return ytId ? (
                  <YouTubePlayer
                    ref={playerRef}
                    videoId={ytId}
                    isHost={isHost}
                    onHostPlay={onHostPlay}
                    onHostPause={onHostPause}
                    onHostSeek={onHostSeek}
                  />
                ) : (
                  <HlsPlayer
                    ref={playerRef}
                    src={room.videoSrc}
                    isHost={isHost}
                    onHostPlay={onHostPlay}
                    onHostPause={onHostPause}
                    onHostSeek={onHostSeek}
                  />
                )
              })()}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isHost ? 'Vous pilotez la lecture' : 'Lecture synchronisée'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {isHost
                  ? 'Utilisez les contrôles du lecteur : lecture, pause et déplacement sont répercutés en temps réel sur tous les invités.'
                  : 'Votre lecteur suit automatiquement le présentateur. Les contrôles sont volontairement désactivés.'}
              </CardContent>
            </Card>
          </div>

          <ParticipantsList participants={participants} currentUserId={currentUserId} />
        </div>
      </div>
    </main>
  )
}
