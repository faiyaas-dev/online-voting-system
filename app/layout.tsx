import type { Metadata } from 'next'
import './globals.css'
import GlobalNav from '@/components/GlobalNav'
import CivicEasterEgg from '@/components/CivicEasterEgg'

export const metadata: Metadata = {
  title: 'Vote. | College Elections You Can Trust',
  description: 'Multi-tenant college election platform — transparent ballots, verified results.',
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0A0A0B] text-white antialiased selection:bg-yellow-400 selection:text-black flex flex-col">
        <GlobalNav />
        <div className="flex-1">
          {children}
        </div>
        <CivicEasterEgg />
      </body>
    </html>
  )
}
