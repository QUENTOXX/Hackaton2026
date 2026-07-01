'use client'

// =====================================================================
// Lobby Watch Together : créer une salle (avec choix de la source vidéo),
// rejoindre par code, lister les salles actives. Créateur = présentateur.
// =====================================================================
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, LogIn, Radio, Crown, RefreshCw, LayoutDashboard, Lock, LogOut, Clock, Upload } from 'lucide-react'

interface RoomSummary {
  code: string
  name: string
  hostName: string
  isHost: boolean
  createdAt: string
}
interface VideoItem {
  file: string
  label: string
  src: string
}

const URL_OPTION = '__url__'
const DEFAULT_OPTION = '__default__'

export function WatchLobby() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [newName, setNewName] = useState('')
  const [sourceValue, setSourceValue] = useState<string>(DEFAULT_OPTION)
  const [urlValue, setUrlValue] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadRooms() {
    setLoading(true)
    try {
      const res = await fetch('/api/rooms')
      const data = await res.json()
      setRooms(data?.rooms ?? [])
    } catch {
      /* silencieux */
    } finally {
      setLoading(false)
    }
  }

  async function loadVideos() {
    try {
      const res = await fetch('/api/videos')
      const data = await res.json()
      const list: VideoItem[] = data?.videos ?? []
      setVideos(list)
      if (list.length > 0) setSourceValue(list[0].src) // 1re vidéo locale par défaut
    } catch {
      /* silencieux */
    }
  }

  async function uploadVideo(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/videos/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Échec de l'import.")
      await loadVideos()
      if (data?.src) setSourceValue(data.src) // sélectionne la vidéo importée
      toast.success(`Vidéo importée : ${data.label ?? data.file}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'import.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // permet de ré-importer le même fichier
    }
  }

  useEffect(() => {
    loadRooms()
    loadVideos()
  }, [])

  function resolveVideoSrc(): string | undefined {
    if (sourceValue === DEFAULT_OPTION) return undefined // -> flux de test serveur
    if (sourceValue === URL_OPTION) return urlValue.trim() || undefined
    return sourceValue // chemin /videos/xxx
  }

  async function createRoom() {
    const videoSrc = resolveVideoSrc()
    if (sourceValue === URL_OPTION && !videoSrc) {
      toast.error('Renseigne une URL de vidéo (fichier .mp4 ou flux .m3u8).')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() || undefined, videoSrc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erreur')
      router.push(`/watch/${data.code}`)
    } catch {
      toast.error('Impossible de créer la salle.')
      setCreating(false)
    }
  }

  function joinRoom(e: FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (code) router.push(`/watch/${code}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge variant="secondary" className="hidden gap-1 sm:flex"><Radio className="h-3 w-3" /> Watch Together</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/watch/history"><Clock className="mr-2 h-4 w-4" /> Historique</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/protected"><Lock className="mr-2 h-4 w-4" /> Espace protégé</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Salons de visionnage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez une session synchronisée ou rejoignez-en une avec son code.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Créer une salle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" /> Créer une salle</CardTitle>
              <CardDescription>Vous en serez le présentateur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Nom de la session (ex. Revue produit)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Source vidéo</label>
                <select
                  value={sourceValue}
                  onChange={(e) => setSourceValue(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {videos.map((v) => (
                    <option key={v.src} value={v.src}>🎬 {v.label}</option>
                  ))}
                  <option value={URL_OPTION}>🔗 Lien externe (YouTube, .mp4, .m3u8)…</option>
                  <option value={DEFAULT_OPTION}>▶︎ Flux de test par défaut</option>
                </select>

                {/* Import d'une vidéo locale (sécurisé : extensions vidéo uniquement) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,.mkv,.avi,.m4v,.ogv,.mov"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadVideo(f)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Import en cours…' : 'Importer une vidéo (mp4, mov, mkv, webm…)'}
                </Button>
              </div>

              {sourceValue === URL_OPTION && (
                <Input
                  placeholder="https://youtube.com/watch?v=… ou https://…/video.mp4"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                />
              )}

              <Button onClick={createRoom} disabled={creating} className="w-full">
                {creating ? 'Création…' : 'Créer et présenter'}
              </Button>
              {videos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Astuce : dépose des fichiers dans <span className="font-mono">public/videos/</span> pour les proposer ici.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Rejoindre une salle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><LogIn className="h-4 w-4 text-primary" /> Rejoindre une salle</CardTitle>
              <CardDescription>Entrez le code partagé par le présentateur.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={joinRoom} className="space-y-3">
                <Input
                  placeholder="Code (ex. 7F3K2)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-widest"
                  maxLength={8}
                />
                <Button type="submit" variant="outline" className="w-full" disabled={!joinCode.trim()}>
                  Rejoindre
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Salles actives */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Salles actives</h2>
          <Button variant="ghost" size="sm" onClick={loadRooms}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!loading && rooms.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune salle active pour le moment.</p>
          )}
          {rooms.map((r) => (
            <button
              key={r.code}
              onClick={() => router.push(`/watch/${r.code}`)}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-left transition hover:border-primary/50 hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  Présentateur : {r.hostName} · code <span className="font-mono">{r.code}</span>
                </p>
              </div>
              <span className="flex items-center gap-2">
                {r.isHost && <Badge className="gap-1 bg-yellow-500/20 text-yellow-300"><Crown className="h-3 w-3" /> vous</Badge>}
                <Badge variant="secondary">Rejoindre</Badge>
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
