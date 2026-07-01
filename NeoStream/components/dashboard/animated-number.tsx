'use client'

// Affiche un nombre qui "compte" jusqu'à sa valeur (effet visuel).
import { useEffect, useRef, useState } from 'react'

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0
    const start = prev.current
    const duration = 600
    const startTime = performance.now()
    let raf = 0
    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (target - start) * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span>{display.toLocaleString('fr-FR')}</span>
}
