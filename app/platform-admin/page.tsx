import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import type { Profile, PlatformMetric } from '@/lib/supabase/types'
import { getRoleHome } from '@/lib/auth/getRoleHome'

function toNum(v: number | string | null | undefined): number {
  return Number(v ?? 0)
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<Pick<Profile, 'role'>>()

  if (!profile) redirect('/login')
  if (profile.role !== 'platform_admin') redirect(`${getRoleHome(profile.role)}?from=platform-admin`)

  // Call get_platform_metrics RPC — aggregates only, no PII
  const { data: metrics, error } = await supabase.rpc('get_platform_metrics')

  // Aggregate-only rows: "Nominating / draft" is derived (total − voting − closed),
  // i.e. nomination_open + draft. No new RPC columns, no PII.
  const rows = ((metrics ?? []) as PlatformMetric[]).map((m) => {
    const total = toNum(m.total_elections)
    const votingNow = toNum(m.active_elections)
    const closed = toNum(m.closed_elections)
    const nominating = Math.max(0, total - votingNow - closed)
    return { m, total, votingNow, closed, nominating }
  })

  const csvDate = new Date().toISOString().slice(0, 10)
  const csvFileName = `platform-metrics-${csvDate}.csv`
  const csvLines = [
    'institution,elections,voting_now,nominating_draft,closed,roster,votes,participation_pct',
    ...rows.map(({ m, total, votingNow, closed, nominating }) =>
      [
        csvEscape(m.institution_name),
        total,
        votingNow,
        nominating,
        closed,
        toNum(m.total_voters),
        toNum(m.total_votes_cast),
        m.participation_pct ?? '',
      ].join(','),
    ),
  ]
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvLines.join('\r\n'))}`

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-widest">Platform Admin</h1>
            <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mt-2">Aggregate Metrics · Cross-Institution View</p>
          </div>
          {!error && rows.length > 0 && (
            <a
              href={csvHref}
              download={csvFileName}
              aria-label="Download aggregate metrics as CSV"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-gray-700 px-5 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:bg-gray-900"
            >
              Export CSV
            </a>
          )}
        </header>

        {error && <p className="text-red-500 font-bold uppercase tracking-widest">{error.message}</p>}

        {!error && (!metrics || metrics.length === 0) && (
          <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
            No institutions registered yet.
          </div>
        )}

        {!error && metrics && metrics.length > 0 && (
          <div className="space-y-8">
            <section className="border border-gray-800 p-6">
              <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-400">Participation by institution</h2>
              <div className="space-y-5">
                {(metrics as PlatformMetric[]).map(m => (
                  <div key={m.institution_id}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-bold">{m.institution_name}</span>
                      <span className="font-mono text-green-400">{m.participation_pct != null ? `${m.participation_pct}%` : '—'}</span>
                    </div>
                    <div className="h-2 overflow-hidden bg-gray-800" role="progressbar" aria-label={`${m.institution_name} participation`} aria-valuenow={Number(m.participation_pct ?? 0)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, Number(m.participation_pct ?? 0)))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="overflow-x-auto border border-gray-800 p-1">
            <table className="w-full text-sm font-mono text-left whitespace-nowrap" aria-label="Participation by institution">
              <thead className="bg-gray-900 text-gray-400 uppercase tracking-widest text-xs">
                <tr>
                  <th scope="col" className="py-4 px-4 font-normal">Institution</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Elections</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Voting now</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Nominating / draft</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Closed</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Roster</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Votes</th>
                  <th scope="col" className="py-4 px-4 font-normal text-right">Participation</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {rows.map(({ m, total, votingNow, closed, nominating }) => (
                  <tr key={m.institution_id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                    <td className="py-4 px-4 font-bold text-white">{m.institution_name}</td>
                    <td className="py-4 px-4 text-right">{total}</td>
                    <td className="py-4 px-4 text-right">{votingNow}</td>
                    <td className="py-4 px-4 text-right">{nominating}</td>
                    <td className="py-4 px-4 text-right">{closed}</td>
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
            <p className="text-xs text-gray-500">
              Participation = votes cast ÷ (roster size × elections in voting or closed status), averaged across elections.
              It is not per-election turnout. “Voting now” counts voting-open elections; “Nominating / draft” = total − voting − closed (nomination_open + draft).
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
