import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Election, Profile } from '@/lib/supabase/types'
import SignOutButton from '@/components/SignOutButton'

function statusBadge(status: Election['status']) {
  const map: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    nomination_open: 'bg-yellow-100 text-yellow-800',
    voting_open: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-gray-100'
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
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Elections</h1>
        <SignOutButton />
      </div>
      {(!elections || elections.length === 0) && (
        <p className="text-gray-500">No elections available for your account.</p>
      )}
      <ul className="flex flex-col gap-4">
        {(elections ?? []).map((e: Election) => (
          <li key={e.id} className="border rounded p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{e.title}</h2>
                <p className="text-sm text-gray-500">
                  {e.scope_department ? `Dept: ${e.scope_department}` : 'Institution-wide'}
                  {e.scope_year ? ` · Year ${e.scope_year}` : ''}
                </p>
                <p className="text-sm text-gray-500">
                  Opens: {new Date(e.opens_at).toLocaleDateString()} · Closes: {new Date(e.closes_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(e.status)}`}>
                {e.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Link href={`/elections/${e.id}/candidates`} className="text-sm text-blue-600 underline">
                View candidates
              </Link>
              {e.status === 'nomination_open' && (
                <Link href={`/elections/${e.id}/nominate`} className="text-sm text-yellow-700 underline">
                  Self-nominate
                </Link>
              )}
              {e.status === 'voting_open' && (
                <Link href={`/elections/${e.id}/vote`} className="text-sm text-green-700 underline">
                  Vote
                </Link>
              )}
              {e.status === 'closed' && (
                <Link href={`/elections/${e.id}/results`} className="text-sm text-gray-600 underline">
                  Results
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

