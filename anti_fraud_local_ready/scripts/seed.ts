// Script de remplissage initial de la base de données.
// Lancé avec : yarn prisma db seed
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // --- Compte administrateur (accès au centre de contrôle) ---
  const adminPass = await bcrypt.hash('johndoe123', 10)
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { role: 'admin' },
    create: { email: 'john@doe.com', name: 'Administrateur', password: adminPass, role: 'admin' },
  })

  // --- Compte administrateur de démo pour l'utilisateur ---
  const adminPass2 = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { email: 'admin@sentinel.fr' },
    update: { role: 'admin' },
    create: { email: 'admin@sentinel.fr', name: 'Admin Sécurité', password: adminPass2, role: 'admin' },
  })

  // --- Compte utilisateur simple (pour tester la page protégée) ---
  const userPass = await bcrypt.hash('user1234', 10)
  await prisma.user.upsert({
    where: { email: 'utilisateur@sentinel.fr' },
    update: {},
    create: { email: 'utilisateur@sentinel.fr', name: 'Marie Dupont', password: userPass, role: 'user' },
  })

  console.log('Seed terminé : comptes créés.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
