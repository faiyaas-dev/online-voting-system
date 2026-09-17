import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import Link from 'next/link'

export default async function GlobalNav() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <nav className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-black border-b border-gray-800 text-white">
      <Link href="/" className="font-extrabold text-xl tracking-widest uppercase hover:text-gray-300 transition-colors">
        Vote.
      </Link>
      <div className="flex items-center gap-6 mt-4 sm:mt-0">
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold tracking-wide">{profile?.full_name || user.email}</span>
          {profile && <span className="text-[10px] text-gray-500 uppercase tracking-widest">{profile.role.replace('_', ' ')}</span>}
        </div>
        <SignOutButton />
      </div>
    </nav>
  )
}
