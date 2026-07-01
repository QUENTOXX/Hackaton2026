'use client'

// =====================================================================
// Lecteur vidéo HLS (hls.js + <video>) — deux modes :
//  - HÔTE  : contrôles natifs actifs ; les actions (play/pause/seek) sont
//            remontées via onHostPlay / onHostPause / onHostSeek.
//  - INVITÉ: contrôles verrouillés ; le lecteur applique les commandes
//            reçues du présentateur via les méthodes impératives du ref.
// =====================================================================
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Hls from 'hls.js'
import type { PlayerHandle } from './player-types'

interface HlsPlayerProps {
  src: string
  isHost: boolean
  onHostPlay?: (positionSec: number, rate?: number) => void
  onHostPause?: (positionSec: number, rate?: number) => void
  onHostSeek?: (positionSec: number, rate?: number) => void
  /** Remonte la durée totale de la vidéo (hôte uniquement), pour la télémétrie. */
  onDuration?: (durationSec: number) => void
}

const SYNC_TOLERANCE = 0.5 // s : on ne recale que si l'écart dépasse ce seuil

export const HlsPlayer = forwardRef<PlayerHandle, HlsPlayerProps>(function HlsPlayer(
  { src, isHost, onHostPlay, onHostPause, onHostSeek, onDuration },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Vrai pendant l'application d'une commande distante -> évite de ré-émettre.
  const suppress = useRef(false)

  // --- Chargement de la source ---
  // On distingue le HLS (.m3u8) des fichiers vidéo classiques (.mp4/.webm…).
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const isHls = /\.m3u8(\?|$)/i.test(src)
    let hls: Hls | null = null

    if (!isHls) {
      // Fichier vidéo lu nativement par le navigateur (mp4, webm, ogg…).
      video.src = src
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari : HLS natif
      video.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(video)
    } else {
      console.warn('HLS non supporté par ce navigateur')
    }
    return () => {
      if (hls) hls.destroy()
    }
  }, [src])

  const withSuppress = (fn: () => void) => {
    suppress.current = true
    fn()
    // petite fenêtre pour laisser passer les events natifs déclenchés
    window.setTimeout(() => {
      suppress.current = false
    }, 60)
  }

  useImperativeHandle(ref, () => ({
    applyPlay(positionSec) {
      const v = videoRef.current
      if (!v) return
      withSuppress(() => {
        if (Math.abs(v.currentTime - positionSec) > SYNC_TOLERANCE) v.currentTime = positionSec
        void v.play().catch(() => {})
      })
    },
    applyPause(positionSec) {
      const v = videoRef.current
      if (!v) return
      withSuppress(() => {
        v.pause()
        if (Math.abs(v.currentTime - positionSec) > SYNC_TOLERANCE) v.currentTime = positionSec
      })
    },
    applySeek(positionSec) {
      const v = videoRef.current
      if (!v) return
      withSuppress(() => {
        if (Math.abs(v.currentTime - positionSec) > SYNC_TOLERANCE) v.currentTime = positionSec
      })
    },
    getTime() {
      return videoRef.current?.currentTime ?? 0
    },
  }))

  // --- Remontée des actions de l'hôte (contrôles natifs) ---
  const emitIfHost = (cb?: (t: number, rate?: number) => void) => {
    if (!isHost || suppress.current) return
    const v = videoRef.current
    if (v && cb) cb(v.currentTime, v.playbackRate)
  }

  // Durée totale connue dès que les métadonnées sont chargées (hôte uniquement).
  const reportDuration = () => {
    const v = videoRef.current
    if (isHost && v && isFinite(v.duration) && v.duration > 0) onDuration?.(v.duration)
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-black">
      <video
        ref={videoRef}
        controls={isHost}
        playsInline
        className="aspect-video w-full"
        onPlay={() => emitIfHost(onHostPlay)}
        onPause={() => emitIfHost(onHostPause)}
        onSeeked={() => emitIfHost(onHostSeek)}
        onLoadedMetadata={reportDuration}
        onDurationChange={reportDuration}
      />
      {!isHost && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur">
          Lecture pilotée par le présentateur
        </div>
      )}
    </div>
  )
})
