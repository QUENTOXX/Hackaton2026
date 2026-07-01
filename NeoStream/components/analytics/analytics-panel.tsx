'use client'

// =====================================================================
// Panneau « Analyse d'audience » (module Data).
//  - Exporte la télémétrie de visionnage réelle (NeoStream) au format
//    attendu par le module Data (CSV conforme à SCHEMA_LOGS.md).
//  - Détecte si le dashboard Streamlit tourne ; propose un bouton pour le
//    DÉMARRER s'il est arrêté ; l'embarque en iframe une fois en ligne.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download, FileJson, ExternalLink, BarChart3, Info, Play, Loader2, Wifi, WifiOff,
} from 'lucide-react'

// URL du dashboard Streamlit (configurable). `?embed=true` masque le chrome Streamlit.
const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL || 'http://localhost:8501'
const EMBED_URL = `${ANALYTICS_URL}${ANALYTICS_URL.includes('?') ? '&' : '?'}embed=true`

type Status = 'checking' | 'running' | 'stopped'

export function AnalyticsPanel() {
  const [status, setStatus] = useState<Status>('checking')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/analytics/status', { cache: 'no-store' })
      const data = await res.json().catch(() => ({ running: false }))
      const running = !!data?.running
      // Ne pas écraser l'état « démarrage en cours » tant qu'il n'est pas prêt.
      if (!startingRef.current) setStatus(running ? 'running' : 'stopped')
      return running
    } catch {
      if (!startingRef.current) setStatus('stopped')
      return false
    }
  }, [])

  // Sondage périodique de l'état (toutes les 5 s).
  useEffect(() => {
    checkStatus()
    const id = setInterval(checkStatus, 5000)
    return () => clearInterval(id)
  }, [checkStatus])

  async function handleStart() {
    setStarting(true)
    startingRef.current = true
    try {
      const res = await fetch('/api/analytics/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Échec du démarrage.')
      }
      if (data?.already) {
        setStatus('running')
        return
      }
      // Le serveur Streamlit met quelques secondes à répondre : on sonde ~30 s.
      toast.info('Démarrage du module… (cela peut prendre ~15 s)')
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        startingRef.current = false
        const up = await checkStatus()
        startingRef.current = true
        if (up) {
          setStatus('running')
          toast.success('Module d’analyse démarré.')
          return
        }
      }
      toast.error(
        "Le module n'a pas répondu. Vérifiez que les dépendances sont installées " +
          '(pip install -r requirements.txt) dans video_analytics/.',
      )
      setStatus('stopped')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec du démarrage.')
      setStatus('stopped')
    } finally {
      setStarting(false)
      startingRef.current = false
    }
  }

  return (
    <div className="space-y-4">
      {/* Export des données */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Analyse d'audience &amp; prédiction de rétention
          </CardTitle>
          <CardDescription>
            Exporte les logs de visionnage réels des salles Watch Together, au format attendu par le
            module Data (zones d'ennui &amp; prédiction de rétention).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="/api/analytics/events?format=csv" download>
                <Download className="mr-2 h-4 w-4" /> Exporter les logs (CSV)
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/analytics/events?format=json" target="_blank" rel="noreferrer">
                <FileJson className="mr-2 h-4 w-4" /> Aperçu JSON
              </a>
            </Button>
            {status === 'running' && (
              <Button asChild variant="ghost">
                <a href={ANALYTICS_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir dans un onglet
                </a>
              </Button>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Une fois le module démarré, allez dans l'onglet Streamlit{' '}
              <span className="font-medium text-foreground">« Importer des logs »</span> et déposez le CSV
              exporté ci-dessus pour analyser les données réelles de NeoStream.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* État du module + embed */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Dashboard d'analyse</CardTitle>
              <CardDescription>
                Module Streamlit sur <code className="font-mono">{ANALYTICS_URL}</code>
              </CardDescription>
            </div>
            {status === 'running' ? (
              <Badge variant="secondary" className="gap-1"><Wifi className="h-3 w-3" /> en ligne</Badge>
            ) : status === 'stopped' ? (
              <Badge variant="outline" className="gap-1 text-muted-foreground"><WifiOff className="h-3 w-3" /> arrêté</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> vérification</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status === 'running' ? (
            <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
              <iframe
                src={EMBED_URL}
                title="Analyse d'audience — Streamlit"
                className="h-[720px] w-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center">
              {starting ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Démarrage du module…</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Lancement de Streamlit — cela peut prendre une quinzaine de secondes.
                    </p>
                  </div>
                </>
              ) : status === 'checking' ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Vérification de l'état du module…</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Le module d'analyse n'est pas démarré</p>
                    <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                      Démarrez-le en un clic (nécessite les dépendances installées :{' '}
                      <code className="font-mono">pip install -r requirements.txt</code> dans{' '}
                      <code className="font-mono">video_analytics/</code>).
                    </p>
                  </div>
                  <Button onClick={handleStart} disabled={starting}>
                    <Play className="mr-2 h-4 w-4" /> Démarrer le module d'analyse
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
