'use client'

// =====================================================================
// Hook de détection des tentatives de capture d'écran.
// Extrait de components/protected/protected-client.tsx pour être réutilisé
// à la fois dans l'espace protégé (Pôle 2) et dans une salle Watch Together.
//
// Détecte :
//  - la touche « Impr. écran » (PrintScreen)
//  - les raccourcis macOS (Cmd+Shift+3/4/5)
//  - le raccourci de capture (Maj+Cmd/Ctrl+S)
//  - l'impression de la page (Ctrl/Cmd+P -> beforeprint)
//
// `onAttempt` reçoit une chaîne décrivant la méthode détectée.
// IMPORTANT : passer un callback STABLE (useCallback) pour éviter de
// ré-attacher les écouteurs à chaque rendu.
// =====================================================================
import { useEffect } from 'react'

export function useScreenshotGuard(onAttempt: (method: string) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key
      if (key === 'PrintScreen') {
        onAttempt('Touche Impr. écran')
      } else if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key)) {
        onAttempt('Raccourci macOS (Cmd+Shift+' + key + ')')
      } else if (e.shiftKey && (e.metaKey || e.ctrlKey) && key.toLowerCase() === 's') {
        onAttempt('Raccourci capture (Maj+Cmd/Ctrl+S)')
      }
    }
    // Impression (Ctrl+P / Cmd+P) — souvent utilisée pour exfiltrer du contenu.
    function onBeforePrint() {
      onAttempt('Impression de la page')
    }
    window.addEventListener('keyup', onKey)
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeprint', onBeforePrint)
    return () => {
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeprint', onBeforePrint)
    }
  }, [onAttempt])
}
