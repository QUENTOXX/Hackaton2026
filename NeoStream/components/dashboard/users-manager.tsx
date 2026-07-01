'use client'

// =====================================================================
// Gestion des comptes utilisateurs (admin). Lister / modifier (nom + rôle
// + réinitialiser le mot de passe) / supprimer, avec garde-fous côté API
// (pas de suppression de soi-même ni du dernier administrateur).
// Composant autonome : il charge ses données et se rafraîchit après action.
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { formatDateFr } from '@/lib/labels'
import { Users, Pencil, Trash2, ShieldCheck, User as UserIcon, LockOpen, Lock } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  sessionCount: number
  logCount: number
  locked: boolean
}

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setUsers(data.users ?? [])
        setCurrentUserId(data.currentUserId ?? null)
      }
    } catch {
      /* silencieux */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>, okMsg: string) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(okMsg)
        await fetchUsers()
        return true
      }
      toast.error(data?.error ?? 'Échec de la modification.')
      return false
    },
    [fetchUsers],
  )

  const toggleRole = (u: UserRow) =>
    patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }, `Rôle de ${u.email} mis à jour.`)

  const openEdit = (u: UserRow) => {
    setEditing(u)
    setEditName(u.name ?? '')
    setEditPassword('')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const body: Record<string, unknown> = { name: editName }
    if (editPassword.trim()) body.password = editPassword.trim()
    const ok = await patch(editing.id, body, `Compte ${editing.email} mis à jour.`)
    setSaving(false)
    if (ok) setEditing(null)
  }

  const unlock = async (u: UserRow) => {
    const res = await fetch(`/api/admin/users/${u.id}/unlock`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`Compte ${u.email} déverrouillé.`)
      await fetchUsers()
    } else {
      toast.error(data?.error ?? 'Déverrouillage impossible.')
    }
  }

  const remove = async (u: UserRow) => {
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`Compte ${u.email} supprimé.`)
      await fetchUsers()
    } else {
      toast.error(data?.error ?? 'Suppression impossible.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> Utilisateurs ({users.length})
        </CardTitle>
        <CardDescription>Gérer les comptes : rôle, nom, mot de passe, suppression.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun utilisateur.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border">
                    {u.role === 'admin' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{u.name || '—'}</span>
                      {u.role === 'admin' ? (
                        <Badge className="bg-primary/15 text-primary">admin</Badge>
                      ) : (
                        <Badge variant="outline">user</Badge>
                      )}
                      {isSelf && <Badge variant="secondary">vous</Badge>}
                      {u.locked && (
                        <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> verrouillé</Badge>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {u.sessionCount} session(s) · {u.logCount} log(s) · créé le {formatDateFr(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {u.locked && (
                      <Button size="xs" variant="outline" onClick={() => unlock(u)} className="text-amber-300 hover:text-amber-200">
                        <LockOpen className="mr-1.5 h-3.5 w-3.5" /> Déverrouiller
                      </Button>
                    )}
                    <Button size="xs" variant="outline" onClick={() => toggleRole(u)}>
                      {u.role === 'admin' ? 'Passer user' : 'Passer admin'}
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="xs" variant="outline" disabled={isSelf} className="text-red-300 hover:text-red-200">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le compte <strong>{u.email}</strong> et ses données associées (sessions) seront supprimés définitivement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(u)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog de modification (nom + réinitialisation du mot de passe) */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {editing?.email}</DialogTitle>
            <DialogDescription>Nom affiché et réinitialisation du mot de passe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nom</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de l'utilisateur" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pass">Nouveau mot de passe</Label>
              <Input id="edit-pass" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" />
              <p className="text-[11px] text-muted-foreground">6 caractères minimum. Laisser vide = inchangé.</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
