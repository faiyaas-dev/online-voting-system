import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import Link from 'next/link'
import { formatRole } from '@/lib/auth/getRoleHome'

const ROLE_PILL: Record<string, string> = {
  platform_admin: 'border-purple-400 text-purple-300 bg-purple-400/10',
  institution_admin: 'border-blue-400 text-blue-300 bg-blue-400/10',
  department_admin: 'border-yellow-400 text-yellow-300 bg-yellow-400/10',
  voter: 'border-green-400 text-green-300 bg-green-400/10',
}

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
    <nav aria-label="Primary" className="sticky top-0 z-50 flex flex-row items-center justify-between gap-3 h-16 px-4 sm:px-6 bg-black/80 backdrop-blur-md border-b border-white/10 text-white">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="font-extrabold text-xl tracking-widest uppercase hover:text-yellow-300 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
          Vote<span className="text-yellow-400">.</span>
        </Link>
        <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-zinc-400">
          <Link href="/elections" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">Elections</Link>
          <Link href="/#how-it-works" className="hidden md:inline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">How it works</Link>
          <Link href="/#transparency" className="hidden md:inline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">Transparency</Link>
        </div>
        {institution?.name && (
          <span className="hidden sm:inline max-w-[30vw] truncate text-[10px] uppercase tracking-[0.24em] text-gray-400" title={institution.name}>
            {institution.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {profile && (
          <span className={`text-[10px] px-2 py-0.5 uppercase font-bold tracking-widest border rounded-full ${ROLE_PILL[profile.role] ?? 'border-gray-700 text-gray-400'}`}>
            {formatRole(profile.role)}
          </span>
        )}
        <span className="hidden sm:flex flex-col items-end text-right">
          <span className="text-sm font-bold tracking-wide max-w-[20vw] truncate">{profile?.full_name || user.email}</span>
        </span>
        <SignOutButton />
      </div>
    </nav>
  )
}
