import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import type { Profile, PlatformMetric } from '@/lib/supabase/types'

export default async function PlatformAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  if (!profile || profile.role !== 'platform_admin') redirect('/')

  // Call get_platform_metrics RPC — aggregates only, no PII
  const { data: metrics, error } = await supabase.rpc('get_platform_metrics')

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-widest">Platform Admin</h1>
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mt-2">Aggregate Metrics · Cross-Institution View</p>
          </div>
          <SignOutButton />
        </header>

        {error && <p className="text-red-500 font-bold uppercase tracking-widest">{error.message}</p>}

        {!error && (!metrics || metrics.length === 0) && (
          <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
            No institutions registered yet.
          </div>
        )}

        {!error && metrics && metrics.length > 0 && (
          <div className="overflow-x-auto border border-gray-800 p-1">
            <table className="w-full text-sm font-mono text-left whitespace-nowrap">
              <thead className="bg-gray-900 text-gray-400 uppercase tracking-widest text-xs">
                <tr>
                  <th className="py-4 px-4 font-normal">Institution</th>
                  <th className="py-4 px-4 font-normal text-right">Elections</th>
                  <th className="py-4 px-4 font-normal text-right">Active</th>
                  <th className="py-4 px-4 font-normal text-right">Closed</th>
                  <th className="py-4 px-4 font-normal text-right">Roster</th>
                  <th className="py-4 px-4 font-normal text-right">Votes</th>
                  <th className="py-4 px-4 font-normal text-right">Participation</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {(metrics as PlatformMetric[]).map(m => (
                  <tr key={m.institution_id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                    <td className="py-4 px-4 font-bold text-white">{m.institution_name}</td>
                    <td className="py-4 px-4 text-right">{m.total_elections}</td>
                    <td className="py-4 px-4 text-right">{m.active_elections}</td>
                    <td className="py-4 px-4 text-right">{m.closed_elections}</td>
                    <td className="py-4 px-4 text-right text-gray-400">{m.total_voters}</td>
                    <td className="py-4 px-4 text-right text-gray-400">{m.total_votes_cast}</td>
                    <td className="py-4 px-4 text-right text-green-500 font-bold">
                      {m.participation_pct != null ? `${m.participation_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
