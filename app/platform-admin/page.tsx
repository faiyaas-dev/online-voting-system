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
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Platform Admin — Cross-Institution View</h1>
        <SignOutButton />
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Aggregate metrics only — no per-vote or per-voter data shown here.
      </p>

      {error && <p className="text-red-600">{error.message}</p>}

      {!error && (!metrics || metrics.length === 0) && (
        <p className="text-gray-500">No institutions registered yet.</p>
      )}

      {!error && metrics && metrics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="py-2 px-3">Institution</th>
                <th className="py-2 px-3 text-right">Total elections</th>
                <th className="py-2 px-3 text-right">Active</th>
                <th className="py-2 px-3 text-right">Closed</th>
                <th className="py-2 px-3 text-right">Roster size</th>
                <th className="py-2 px-3 text-right">Votes cast</th>
                <th className="py-2 px-3 text-right">Participation %</th>
              </tr>
            </thead>
            <tbody>
              {(metrics as PlatformMetric[]).map(m => (
                <tr key={m.institution_id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">{m.institution_name}</td>
                  <td className="py-2 px-3 text-right">{m.total_elections}</td>
                  <td className="py-2 px-3 text-right">{m.active_elections}</td>
                  <td className="py-2 px-3 text-right">{m.closed_elections}</td>
                  <td className="py-2 px-3 text-right">{m.total_voters}</td>
                  <td className="py-2 px-3 text-right">{m.total_votes_cast}</td>
                  <td className="py-2 px-3 text-right">
                    {m.participation_pct != null ? `${m.participation_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
