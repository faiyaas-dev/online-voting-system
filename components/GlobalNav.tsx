import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import Link from 'next/link'

export default async function GlobalNav() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const institutionId = profile?.institution_id
  const { data: institution } = institutionId
    ? await supabase.from('institutions').select('name').eq('id', institutionId).single()
    : { data: null }

  return (
    <nav className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-black border-b border-gray-800 text-white">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-extrabold text-xl tracking-widest uppercase hover:text-gray-300 transition-colors">
          Vote.
        </Link>
        {institution?.name && (
          <span className="text-[10px] uppercase tracking-[0.24em] text-gray-400 hidden sm:inline-block">
            {institution.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 mt-4 sm:mt-0">
        <div className="flex flex-col items-end text-right">
          <span className="text-sm font-bold tracking-wide">{profile?.full_name || user.email}</span>
          {profile && (
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">
              {institution?.name ? `${institution.name} · ` : ''}{profile.role.replace('_', ' ')}
            </span>
          )}
        </div>
        <SignOutButton />
      </div>
    </nav>
  )
}
