'use client'

// Formulaire de connexion et d'inscription (composant client).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'

export function AuthForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // --- Connexion ---
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // --- Inscription ---
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (res?.error) {
        toast.error('Email ou mot de passe incorrect.')
      } else {
        toast.success('Connexion réussie !')
        // La page racine redirige ensuite selon le rôle
        router.replace('/')
        router.refresh()
      }
    } catch {
      toast.error('Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? "Impossible de créer le compte.")
        return
      }
      // Connexion automatique après inscription
      const login = await signIn('credentials', { email, password, redirect: false })
      if (login?.error) {
        toast.error('Compte créé, mais connexion impossible.')
      } else {
        toast.success('Compte créé avec succès !')
        router.replace('/')
        router.refresh()
      }
    } catch {
      toast.error('Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border/60 bg-card/80 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="font-display text-2xl tracking-tight">Accès sécurisé</CardTitle>
        <CardDescription>Connectez-vous ou créez un compte pour continuer.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          {/* Connexion */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-email" type="email" required placeholder="vous@exemple.fr"
                    className="pl-10" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-password" type="password" required placeholder="••••••••"
                    className="pl-10" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                <LogIn className="mr-2 h-4 w-4" /> Se connecter
              </Button>
            </form>
          </TabsContent>

          {/* Inscription */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Nom</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="signup-name" type="text" placeholder="Votre nom"
                    className="pl-10" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="signup-email" type="email" required placeholder="vous@exemple.fr"
                    className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="signup-password" type="password" required placeholder="Au moins 6 caractères"
                    className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                <UserPlus className="mr-2 h-4 w-4" /> Créer mon compte
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
