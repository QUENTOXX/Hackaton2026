// Page de connexion / inscription.
// Composant serveur : redirige si l'utilisateur est déjà connecté.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuthForm } from '@/components/auth/auth-form'
import { Logo } from '@/components/brand/logo'
import { ShieldCheck, Wifi, Camera, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const role = (session.user as any).role
    redirect(role === 'admin' ? '/dashboard' : '/protected')
  }

  const features = [
    { icon: Users, title: 'Connexions simultanées', desc: 'Détection des comptes utilisés depuis plusieurs lieux en même temps.' },
    { icon: Wifi, title: 'Blocage VPN / Proxy', desc: "Analyse de réputation des adresses IP en temps réel." },
    { icon: Camera, title: "Captures d'écran", desc: "Surveillance des tentatives de capture sur les pages protégées." },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 cyber-grid opacity-60" />
      <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-12 lg:flex-row lg:gap-16">
        {/* Présentation */}
        <div className="w-full max-w-lg">
          <Logo />
          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-glow sm:text-5xl">
            Centre de contrôle <span className="text-primary">anti-fraude</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Surveillez les menaces en temps réel : connexions suspectes, VPN/Proxies
            et tentatives de capture d'écran, dans une seule interface de sécurité.
          </p>
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Formulaire */}
        <div className="w-full max-w-md">
          <AuthForm />
        </div>
      </div>
    </main>
  )
}
