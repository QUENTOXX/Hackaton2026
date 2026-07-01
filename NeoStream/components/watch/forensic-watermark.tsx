'use client'

// =====================================================================
// Filigrane forensic dynamique (Pôle 2 · anti-scraping / traçabilité).
// Superpose l'identité du spectateur (email) + un horodatage live sur la
// vidéo. Semi-transparent et EN MOUVEMENT (change de coin périodiquement)
// pour être difficile à masquer : si quelqu'un filme ou capture l'écran,
// son identité fuit avec l'image -> dissuasion + preuve forensic.
//
// `pointer-events-none` : n'interfère jamais avec le lecteur.
// =====================================================================
import { useEffect, useState } from 'react'

// Positions successives du filigrane (coins + centre), parcourues en boucle.
const POSITIONS = [
  'top-4 left-4',
  'top-4 right-4',
  'bottom-16 right-4',
  'bottom-16 left-4',
  'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
]

export function ForensicWatermark({ label }: { label: string }) {
  const [pos, setPos] = useState(0)
  const [now, setNow] = useState('')

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('fr-FR'))
    tick()
    const clock = setInterval(tick, 1000)
    const move = setInterval(() => setPos((p) => (p + 1) % POSITIONS.length), 4000)
    return () => {
      clearInterval(clock)
      clearInterval(move)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      <div
        className={`absolute ${POSITIONS[pos]} whitespace-nowrap font-mono text-[11px] leading-tight text-white/25 transition-all duration-1000`}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        <div>{label}</div>
        <div className="text-white/20">{now}</div>
      </div>
    </div>
  )
}
