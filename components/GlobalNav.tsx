import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import Link from 'next/link'
import { formatRole } from '@/lib/auth/getRoleHome'

const ROLE_PILL: Record<string, string> = {
  platform_admin: 'border-purple-500 text-purple-400',
  institution_admin: 'border-blue-500 text-blue-400',
  department_admin: 'border-yellow-500 text-yellow-400',
  voter: 'border-green-500 text-green-400',
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
    <nav className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-black border-b border-gray-800 text-white">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-extrabold text-xl tracking-widest uppercase hover:text-gray-300 transition-colors">
          Vote.
        </Link>
        {institution?.name && (
          <span className="max-w-[50vw] truncate text-[10px] uppercase tracking-[0.24em] text-gray-400" title={institution.name}>
            {institution.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 mt-4 sm:mt-0">
        <div className="flex flex-col items-end text-right">
          <span className="text-sm font-bold tracking-wide">{profile?.full_name || user.email}</span>
          {profile && (
            <span className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 uppercase font-bold tracking-widest border ${ROLE_PILL[profile.role] ?? 'border-gray-700 text-gray-400'}`}>
                {formatRole(profile.role)}
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                {institution?.name ? `${institution.name}` : ''}
              </span>
            </span>
          )}
        </div>
        <SignOutButton />
      </div>
    </nav>
  )
}
