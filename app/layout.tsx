import type { Metadata } from 'next'
import './globals.css'
import GlobalNav from '@/components/GlobalNav'

export const metadata: Metadata = {
  title: 'College Election System',
  description: 'Multi-tenant college election platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white flex flex-col">
        <GlobalNav />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  )
}
