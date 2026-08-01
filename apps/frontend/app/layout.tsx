import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import { CartProvider } from '@/lib/CartContext'
import { BottomNav } from '@/components/employee/BottomNav'

export const metadata: Metadata = {
  title: 'RestoMoney — Commande de repas entreprises',
  description: 'Vos plats sont livrés bien chauds. Une promesse que nous honorons depuis 5 ans.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <CartProvider>
            {children}
            <BottomNav />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
