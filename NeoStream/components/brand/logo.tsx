import { ShieldCheck, MonitorPlay } from 'lucide-react'
import { cn } from '@/lib/utils'

type Brand = 'neostream' | 'sentinelguard'

// Logo contextuel de la plateforme :
//  - "neostream"      : partie publique/ludique (accueil, Watch Together) — écran + lecture.
//  - "sentinelguard"  : module sécurité/admin (dashboard) — bouclier rose.
export function Logo({
  className,
  showText = true,
  brand = 'neostream',
}: {
  className?: string
  showText?: boolean
  brand?: Brand
}) {
  const Icon = brand === 'sentinelguard' ? ShieldCheck : MonitorPlay

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 glow-pink">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      {showText && (
        <div className="leading-none">
          <span className="font-display text-lg font-bold tracking-tight">
            {brand === 'sentinelguard' ? (
              <>
                Sentinel<span className="text-primary">Guard</span>
              </>
            ) : (
              <>
                Neo<span className="text-primary">Stream</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
