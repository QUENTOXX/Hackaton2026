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
import { useScreenshotGuard } from '@/hooks/use-screenshot-guard'
import { EV, type JoinAck, type Participant, type RoomState, type ScreenshotAlert } from '@/lib/realtime/socket-events'
import { HlsPlayer } from '@/components/watch/hls-player'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { ForensicWatermark } from '@/components/watch/forensic-watermark'
import { ChangeVideoDialog } from '@/components/watch/change-video-dialog'
import { getYouTubeId, type PlayerHandle } from '@/components/watch/player-types'
import { ParticipantsList } from '@/components/watch/participants-list'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Crown, Radio, Wifi, WifiOff, PowerOff, ShieldAlert, Camera, Film, Gamepad2 } from 'lucide-react'

export function RoomClient({
  code,
  currentUserId,
  currentUserEmail,
}: {
  code: string
  currentUserId: string
  currentUserEmail: string
}) {
  const router = useRouter()
  const { socket, connected, error } = useSocket()
  const playerRef = useRef<PlayerHandle>(null)

  const [room, setRoom] = useState<RoomState | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isHost, setIsHost] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [hostNotice, setHostNotice] = useState<string | null>(null)
  const [screenshotAlerts, setScreenshotAlerts] = useState<ScreenshotAlert[]>([])
  const [controllers, setControllers] = useState<string[]>([])
  const [changeVideoOpen, setChangeVideoOpen] = useState(false)
  const wasController = useRef(false)

  // L'utilisateur peut piloter la lecture : hôte OU co-présentateur autorisé.
  const isController = isHost || controllers.includes(currentUserId)

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
      setControllers(res.state.controllers ?? [])
      wasController.current = (res.state.controllers ?? []).includes(currentUserId)
      applyInitial(res.state)
    })

    const onParticipants = (list: Participant[]) => setParticipants(list)
    const onControllers = (list: string[]) => {
      setControllers(list)
      const now = list.includes(currentUserId)
      // L'hôte n'est jamais dans la liste -> pas de toast pour lui.
      if (now !== wasController.current) {
        toast[now ? 'success' : 'info'](
          now ? 'Le présentateur vous a donné les droits de pilotage.' : 'Vos droits de pilotage ont été retirés.',
        )
      }
      wasController.current = now
    }
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
    const onScreenshotAlert = (a: ScreenshotAlert) => {
      setScreenshotAlerts((prev) => [a, ...prev].slice(0, 20))
      toast.warning(`${a.name} a tenté une capture d'écran (${a.method}).`)
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
    socket.on(EV.ROOM_CONTROLLERS, onControllers)
    socket.on(EV.SYNC_PLAY, onPlay)
    socket.on(EV.SYNC_PAUSE, onPause)
    socket.on(EV.SYNC_SEEK, onSeek)
    socket.on(EV.ROOM_VIDEO_CHANGED, onVideoChanged)
    socket.on(EV.ROOM_HOST_DISCONNECTED, onHostDisconnected)
    socket.on(EV.ROOM_HOST_RECONNECTED, onHostReconnected)
    socket.on(EV.ROOM_HOST_CHANGED, onHostChanged)
    socket.on(EV.ROOM_SCREENSHOT_ALERT, onScreenshotAlert)
    socket.on(EV.ROOM_ENDED, onEnded)

    return () => {
      socket.off(EV.ROOM_PARTICIPANTS, onParticipants)
      socket.off(EV.ROOM_CONTROLLERS, onControllers)
      socket.off(EV.SYNC_PLAY, onPlay)
      socket.off(EV.SYNC_PAUSE, onPause)
      socket.off(EV.SYNC_SEEK, onSeek)
      socket.off(EV.ROOM_VIDEO_CHANGED, onVideoChanged)
      socket.off(EV.ROOM_HOST_DISCONNECTED, onHostDisconnected)
      socket.off(EV.ROOM_HOST_RECONNECTED, onHostReconnected)
      socket.off(EV.ROOM_HOST_CHANGED, onHostChanged)
      socket.off(EV.ROOM_SCREENSHOT_ALERT, onScreenshotAlert)
      socket.off(EV.ROOM_ENDED, onEnded)
    }
  }, [socket, connected, code, currentUserId, applyInitial, router])

  // --- Actions de l'hôte (remontées par le lecteur) ---
  const onHostPlay = (positionSec: number, rate?: number) => socket?.emit(EV.PRESENTER_PLAY, { positionSec, rate })
  const onHostPause = (positionSec: number, rate?: number) => socket?.emit(EV.PRESENTER_PAUSE, { positionSec, rate })
  const onHostSeek = (positionSec: number, rate?: number) => socket?.emit(EV.PRESENTER_SEEK, { positionSec, rate })
  // Durée totale de la vidéo, remontée une fois par le lecteur de l'hôte (télémétrie Pôle 3).
  const onDuration = (durationSec: number) => socket?.emit(EV.PRESENTER_DURATION, { durationSec })

  // --- Actions réservées à l'hôte ---
  const changeVideo = (src: string) => socket?.emit(EV.PRESENTER_LOAD, { videoSrc: src })
  const toggleControl = (userId: string, next: boolean) =>
    socket?.emit(next ? EV.PRESENTER_GRANT : EV.PRESENTER_REVOKE, { userId })

  // --- Surveillance capture d'écran : toast local + remontée au serveur ---
  const reportScreenshot = useCallback(
    (method: string) => {
      toast.error(`Tentative de capture d'écran détectée (${method}) — enregistrée.`)
      socket?.emit(EV.SCREENSHOT_ATTEMPT, { method })
    },
    [socket],
  )
  useScreenshotGuard(reportScreenshot)

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
            ) : isController ? (
              <Badge className="gap-1 bg-emerald-500/20 text-emerald-300"><Gamepad2 className="h-3 w-3" /> co-présentateur</Badge>
            ) : (
              <Badge variant="outline">invité</Badge>
            )}
            {isHost && (
              <Button variant="outline" size="sm" onClick={() => setChangeVideoOpen(true)}>
                <Film className="mr-2 h-4 w-4" /> Changer la vidéo
              </Button>
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
                return (
                  // Conteneur relatif : le filigrane forensic se superpose au lecteur.
                  <div className="relative" onContextMenu={(e) => e.preventDefault()}>
                    {ytId ? (
                      <YouTubePlayer
                        ref={playerRef}
                        videoId={ytId}
                        canControl={isController}
                        onHostPlay={onHostPlay}
                        onHostPause={onHostPause}
                        onHostSeek={onHostSeek}
                        onDuration={onDuration}
                      />
                    ) : (
                      <HlsPlayer
                        ref={playerRef}
                        src={room.videoSrc}
                        canControl={isController}
                        onHostPlay={onHostPlay}
                        onHostPause={onHostPause}
                        onHostSeek={onHostSeek}
                        onDuration={onDuration}
                      />
                    )}
                    <ForensicWatermark label={currentUserEmail} />
                  </div>
                )
              })()}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isController ? 'Vous pilotez la lecture' : 'Lecture synchronisée'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {isHost
                  ? 'Utilisez les contrôles du lecteur : lecture, pause et déplacement sont répercutés en temps réel sur tous les invités. Vous pouvez aussi changer la vidéo ou donner les droits de pilotage à un invité.'
                  : isController
                    ? 'Le présentateur vous a autorisé à piloter : vos actions (lecture, pause, déplacement) sont synchronisées avec tout le monde.'
                    : 'Votre lecteur suit automatiquement le présentateur. Les contrôles sont volontairement désactivés.'}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <ParticipantsList
              participants={participants}
              currentUserId={currentUserId}
              controllers={controllers}
              canManage={isHost}
              onToggleControl={toggleControl}
            />

            {/* Panneau sécurité : surveillance des captures d'écran */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" /> Sécurité
                  </span>
                  {isHost && screenshotAlerts.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <Camera className="h-3 w-3" /> {screenshotAlerts.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                  Surveillance des captures d’écran active.
                </p>

                {isHost ? (
                  screenshotAlerts.length === 0 ? (
                    <p className="mt-2 text-xs">Aucune tentative détectée pour l’instant.</p>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {screenshotAlerts.map((a, i) => (
                        <li
                          key={`${a.at}-${i}`}
                          className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200"
                        >
                          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            <span className="font-medium text-foreground">{a.name}</span> — {a.method}
                            <span className="ml-1 font-mono text-[10px] opacity-70">
                              {new Date(a.at).toLocaleTimeString('fr-FR')}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="mt-2 text-xs">
                    Toute tentative de capture est signalée au présentateur et journalisée.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {isHost && (
        <ChangeVideoDialog open={changeVideoOpen} onOpenChange={setChangeVideoOpen} onConfirm={changeVideo} />
      )}
    </main>
  )
}
