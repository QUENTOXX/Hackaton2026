'use client'

// =====================================================================
// Lecteur YouTube (API IFrame) — même interface que HlsPlayer.
// YouTube ne peut pas être lu dans une balise <video> : on pilote son
// lecteur iframe via l'API officielle (playVideo / pauseVideo / seekTo).
//  - HÔTE  : contrôles actifs ; play/pause remontés via onStateChange,
//            seek détecté par échantillonnage (YouTube n'a pas d'event seek).
//  - INVITÉ: démarré en sourdine (autoplay autorisé) + overlay bloquant,
//            avec un bouton « Activer le son ». Applique les commandes reçues.
//
// Les commandes reçues avant que le lecteur soit prêt sont mises en file
// d'attente et rejouées à onReady (sinon seekTo/playVideo n'existent pas).
// =====================================================================
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PlayerHandle } from './player-types'

interface YouTubePlayerProps {
  videoId: string
  isHost: boolean
  onHostPlay?: (positionSec: number, rate?: number) => void
  onHostPause?: (positionSec: number, rate?: number) => void
  onHostSeek?: (positionSec: number, rate?: number) => void
  /** Remonte la durée totale de la vidéo (hôte uniquement), pour la télémétrie. */
  onDuration?: (durationSec: number) => void
}

type Cmd = { type: 'play' | 'pause' | 'seek'; pos: number }
const SYNC_TOLERANCE = 0.7

// Chargement unique de l'API IFrame de YouTube.
let apiPromise: Promise<void> | null = null
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const w = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void }
  if (w.YT && w.YT.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (prev) prev()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

export const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, isHost, onHostPlay, onHostPause, onHostSeek, onDuration },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const ready = useRef(false)
  const suppress = useRef(false)
  const lastTime = useRef(0)
  const pending = useRef<Cmd | null>(null)
  // Passe à true seulement si le navigateur a bloqué l'autoplay avec son
  // (on a alors basculé en sourdine) -> on propose d'activer le son.
  const [needsUnmute, setNeedsUnmute] = useState(false)

  const withSuppress = (fn: () => void) => {
    suppress.current = true
    fn()
    window.setTimeout(() => {
      suppress.current = false
    }, 400)
  }

  // Applique réellement une commande sur un lecteur PRÊT.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doApply = (p: any, cmd: Cmd) => {
    withSuppress(() => {
      const cur = p.getCurrentTime?.() ?? 0
      if (cmd.type === 'play') {
        if (Math.abs(cur - cmd.pos) > SYNC_TOLERANCE) p.seekTo(cmd.pos, true)
        p.playVideo?.()
        // Invité : si l'autoplay AVEC son est bloqué, on repli en sourdine.
        if (!isHost) {
          window.setTimeout(() => {
            const st = playerRef.current?.getPlayerState?.() // 1=playing, 3=buffering
            if (st !== 1 && st !== 3) {
              try {
                playerRef.current?.mute?.()
                playerRef.current?.playVideo?.()
              } catch {
                /* ignore */
              }
              setNeedsUnmute(true)
            }
          }, 900)
        }
      } else if (cmd.type === 'pause') {
        p.pauseVideo?.()
        if (Math.abs(cur - cmd.pos) > SYNC_TOLERANCE) p.seekTo(cmd.pos, true)
      } else {
        p.seekTo(cmd.pos, true)
      }
    })
  }

  // Applique si prêt, sinon met en file d'attente pour onReady.
  const apply = (cmd: Cmd) => {
    const p = playerRef.current
    if (p && ready.current && typeof p.seekTo === 'function') doApply(p, cmd)
    else pending.current = cmd
  }

  useEffect(() => {
    let destroyed = false
    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            ready.current = true
            // Rejoue la dernière commande reçue avant d'être prêt.
            if (pending.current) {
              doApply(playerRef.current, pending.current)
              pending.current = null
            }
            // Durée totale : getDuration() peut renvoyer 0 tant que la vidéo n'a
            // pas commencé à charger -> on ré-essaie quelques fois (hôte only).
            if (isHost) {
              let tries = 0
              const poll = window.setInterval(() => {
                const d = playerRef.current?.getDuration?.() ?? 0
                if (d > 0) {
                  onDuration?.(d)
                  window.clearInterval(poll)
                } else if (++tries > 10) {
                  window.clearInterval(poll)
                }
              }, 1000)
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            if (!isHost || suppress.current) return
            const t = playerRef.current?.getCurrentTime?.() ?? 0
            const rate = playerRef.current?.getPlaybackRate?.() ?? 1
            if (e.data === YT.PlayerState.PLAYING) onHostPlay?.(t, rate)
            else if (e.data === YT.PlayerState.PAUSED) onHostPause?.(t, rate)
          },
        },
      })
    })
    return () => {
      destroyed = true
      try {
        playerRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
      playerRef.current = null
      ready.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isHost])

  // Détection du seek de l'hôte par échantillonnage (pas d'event natif).
  useEffect(() => {
    if (!isHost) return
    const id = window.setInterval(() => {
      const p = playerRef.current
      if (!p || !ready.current || suppress.current) return
      const t = p.getCurrentTime?.() ?? 0
      const state = p.getPlayerState?.() // 1 = playing
      const expected = lastTime.current + 1
      if (state === 1 && Math.abs(t - expected) > 1.5) onHostSeek?.(t, p.getPlaybackRate?.() ?? 1)
      lastTime.current = t
    }, 1000)
    return () => window.clearInterval(id)
  }, [isHost, onHostSeek])

  useImperativeHandle(ref, () => ({
    applyPlay: (pos) => apply({ type: 'play', pos }),
    applyPause: (pos) => apply({ type: 'pause', pos }),
    applySeek: (pos) => apply({ type: 'seek', pos }),
    getTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
  }))

  function unmute() {
    try {
      playerRef.current?.unMute?.()
      playerRef.current?.setVolume?.(100)
    } catch {
      /* ignore */
    }
    setNeedsUnmute(false)
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-black">
      <div className="aspect-video w-full">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!isHost && (
        <>
          {/* Bloque toute interaction de l'invité avec le lecteur YouTube. */}
          <div className="absolute inset-0" />
          {needsUnmute && (
            <button
              onClick={unmute}
              className="absolute right-3 top-3 z-10 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:opacity-90"
            >
              🔊 Activer le son
            </button>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur">
            Lecture pilotée par le présentateur
          </div>
        </>
      )}
    </div>
  )
})
