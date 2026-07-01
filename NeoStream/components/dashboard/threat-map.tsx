'use client'

// =====================================================================
// Carte des menaces : géolocalise les connexions actives à partir des
// coordonnées (latitude/longitude) remontées par la réputation IP.
// Projection équirectangulaire pure (aucune dépendance externe) :
//   x = (lon + 180) / 360 * 360   |   y = (90 - lat) / 180 * 180
// Les sessions suspectes (isFlagged) ressortent en rouge, les autres en vert.
// =====================================================================
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Globe } from 'lucide-react'
import type { SessionItem } from './sessions-table'

const W = 360
const H = 180

function project(lat: number, lon: number) {
  const x = ((lon + 180) / 360) * W
  const y = ((90 - lat) / 180) * H
  return { x, y }
}

export function ThreatMap({ sessions }: { sessions: SessionItem[] }) {
  const points = (sessions ?? []).filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
  )
  const flagged = points.filter((p) => p.isFlagged).length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" /> Carte des menaces
        </CardTitle>
        <CardDescription>
          {points.length} connexion(s) géolocalisée(s){flagged > 0 ? ` · ${flagged} suspecte(s)` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-[#0a1020]">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Carte des connexions">
            {/* Graticule (lignes de longitude / latitude tous les 30°) */}
            <g stroke="currentColor" className="text-slate-600/30" strokeWidth={0.3}>
              {Array.from({ length: 11 }, (_, i) => (i + 1) * 30).map((lon) => (
                <line key={`v${lon}`} x1={(lon / 360) * W} y1={0} x2={(lon / 360) * W} y2={H} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (i + 1) * 30).map((lat) => (
                <line key={`h${lat}`} x1={0} y1={(lat / 180) * H} x2={W} y2={(lat / 180) * H} />
              ))}
            </g>
            {/* Équateur & méridien de Greenwich accentués */}
            <g stroke="currentColor" className="text-slate-500/40" strokeWidth={0.5}>
              <line x1={0} y1={H / 2} x2={W} y2={H / 2} />
              <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
            </g>

            {/* Points géolocalisés */}
            {points.map((p) => {
              const { x, y } = project(p.latitude as number, p.longitude as number)
              const color = p.isFlagged ? '#f87171' : '#34d399'
              return (
                <g key={p.id}>
                  <circle cx={x} cy={y} r={p.isFlagged ? 5 : 4} fill={color} opacity={0.15}>
                    {p.isFlagged && (
                      <animate attributeName="r" values="4;8;4" dur="1.8s" repeatCount="indefinite" />
                    )}
                  </circle>
                  <circle cx={x} cy={y} r={1.8} fill={color}>
                    <title>{`${p.userEmail} · ${p.location ?? 'Inconnu'} · ${p.ipAddress}${p.isFlagged ? ' · SUSPECTE' : ''}`}</title>
                  </circle>
                </g>
              )
            })}
          </svg>

          {points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Aucune connexion géolocalisée pour l’instant.
            </div>
          )}
        </div>

        {/* Légende */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Connexion normale</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Session suspecte</span>
        </div>
      </CardContent>
    </Card>
  )
}
