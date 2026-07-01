'use client'

// =====================================================================
// Hook de connexion Socket.io côté client.
// La connexion se fait sur la même origine (même port que Next), donc le
// cookie de session NextAuth est envoyé automatiquement -> auth transparente.
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface UseSocketResult {
  socket: Socket | null
  connected: boolean
  error: string | null
}

export function useSocket(): UseSocketResult {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // withCredentials : envoie le cookie de session pour l'auth handshake.
    const socket = io({ withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => setError(err.message))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  return { socket: socketRef.current, connected, error }
}
