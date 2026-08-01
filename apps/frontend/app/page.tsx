'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      router.replace(isAuthenticated ? '/commande' : '/login')
    }
  }, [isAuthenticated, loading, router])

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-400 animate-pulse text-lg">Chargement…</div>
    </div>
  )
}
