import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// Logo de l'application : bouclier rose + nom "SentinelGuard".
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 glow-pink">
        <ShieldCheck className="h-5 w-5 text-primary" />
      </div>
      {showText && (
        <div className="leading-none">
          <span className="font-display text-lg font-bold tracking-tight">
            Sentinel<span className="text-primary">Guard</span>
          </span>
        </div>
      )}
    </div>
  )
}
