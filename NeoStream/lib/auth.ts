// =====================================================================
// Configuration de l'authentification (NextAuth v4 + Prisma)
// On utilise une connexion simple par email + mot de passe.
// =====================================================================
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  registerFailedLogin,
  clearFailedLogin,
  lockRemainingMs,
  ipFromNextAuthReq,
} from '@/lib/login-guard'
import { isExemptIp } from '@/lib/allow-list'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // On stocke la session dans un JWT (pas besoin de table de sessions NextAuth)
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      // Fonction qui vérifie les identifiants à la connexion
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase()
        const ip = ipFromNextAuthReq(req)
        // IP locale ou en liste blanche -> exemptée du verrouillage anti-brute-force.
        const exempt = await isExemptIp(ip)

        // Anti-brute-force : si le compte/IP est verrouillé, on refuse d'emblée.
        if (!exempt && lockRemainingMs(email, ip) > 0) {
          throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          if (!exempt) await registerFailedLogin(email, ip)
          return null
        }

        // Comparaison du mot de passe avec le hash stocké
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          if (!exempt) await registerFailedLogin(email, ip)
          return null
        }

        // Succès : on efface le compteur d'échecs.
        clearFailedLogin(email, ip)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    // On ajoute le rôle et l'id dans le token JWT
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = (user as any).id
      }
      return token
    },
    // On expose le rôle et l'id dans la session côté client
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = token.role
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
