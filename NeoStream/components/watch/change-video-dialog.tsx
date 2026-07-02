'use client'

// =====================================================================
// Popup « Changer la vidéo » (présentateur) — reprend le sélecteur de
// source du lobby : vidéos locales + import d'un fichier + lien externe
// (YouTube / .mp4 / .m3u8). À la confirmation, on diffuse la nouvelle
// source à toute la salle via presenter:loadVideo.
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, PlayCircle } from 'lucide-react'

interface VideoItem { file: string; label: string; src: string }
const URL_OPTION = '__url__'

export function ChangeVideoDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (src: string) => void
}) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [sourceValue, setSourceValue] = useState<string>(URL_OPTION)
  const [urlValue, setUrlValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadVideos() {
    try {
      const res = await fetch('/api/videos')
      const data = await res.json()
      const list: VideoItem[] = data?.videos ?? []
      setVideos(list)
      if (list.length > 0) setSourceValue(list[0].src)
    } catch {
      /* silencieux */
    }
  }

  useEffect(() => {
    if (open) loadVideos()
  }, [open])

  async function uploadVideo(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/videos/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Échec de l'import.")
      await loadVideos()
      if (data?.src) setSourceValue(data.src)
      toast.success(`Vidéo importée : ${data.label ?? data.file}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'import.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function resolveSrc(): string | undefined {
    if (sourceValue === URL_OPTION) return urlValue.trim() || undefined
    return sourceValue
  }

  function confirm() {
    const src = resolveSrc()
    if (!src) {
      toast.error('Choisis une vidéo ou colle un lien.')
      return
    }
    onConfirm(src)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer la vidéo</DialogTitle>
          <DialogDescription>La nouvelle vidéo sera diffusée à tous les participants.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
            </select>

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
            <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
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
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button onClick={confirm} disabled={uploading}>
            <PlayCircle className="mr-2 h-4 w-4" /> Diffuser cette vidéo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
