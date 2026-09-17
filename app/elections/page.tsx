import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Election, Profile } from '@/lib/supabase/types'

function statusBadge(status: Election['status']) {
  const map: Record<string, string> = {
    draft: 'border-gray-700 text-gray-500',
    nomination_open: 'border-yellow-500 text-yellow-500',
    voting_open: 'border-green-500 text-green-500',
    closed: 'border-red-500 text-red-500',
  }
  return map[status] || 'border-gray-700 text-gray-500'
}

export default async function ElectionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/login')

  // RLS already filters elections by eligibility
  const { data: elections } = await supabase
    .from('elections')
    .select('*')
    .order('opens_at', { ascending: false })

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-extrabold uppercase tracking-widest">Elections</h1>
        </header>

        {(!elections || elections.length === 0) ? (
          <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
            No elections currently available.
          </div>
        ) : (
          <ul className="space-y-6">
            {(elections ?? []).map((e: Election) => (
              <li key={e.id} className="border border-gray-800 bg-transparent p-6 sm:p-8 hover:border-gray-600 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-2">
                    <h2 className="font-bold text-2xl uppercase tracking-wider">{e.title}</h2>
                    <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gray-400 font-bold">
                      <span>{e.scope_department ? `Dept: ${e.scope_department}` : 'Institution-wide'}{e.scope_year ? ` · Year ${e.scope_year}` : ''}</span>
                      <span>{new Date(e.opens_at).toLocaleDateString()} — {new Date(e.closes_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-3 py-1 uppercase font-bold tracking-widest border ${statusBadge(e.status)}`}>
                    {e.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-8 flex flex-wrap gap-6">
                  <Link href={`/elections/${e.id}/candidates`} className="text-[11px] font-bold uppercase tracking-widest text-white border-b border-transparent hover:border-white pb-1 transition-colors">
                    View Candidates
                  </Link>
                  {e.status === 'nomination_open' && (
                    <Link href={`/elections/${e.id}/nominate`} className="text-[11px] font-bold uppercase tracking-widest text-yellow-500 border-b border-transparent hover:border-yellow-500 pb-1 transition-colors">
                      Self-Nominate
                    </Link>
                  )}
                  {e.status === 'voting_open' && (
                    <Link href={`/elections/${e.id}/vote`} className="text-[11px] font-bold uppercase tracking-widest text-green-500 border-b border-transparent hover:border-green-500 pb-1 transition-colors">
                      Vote Now
                    </Link>
                  )}
                  {e.status === 'closed' && (
                    <Link href={`/elections/${e.id}/results`} className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:text-white hover:border-white pb-1 transition-colors">
                      Results
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

