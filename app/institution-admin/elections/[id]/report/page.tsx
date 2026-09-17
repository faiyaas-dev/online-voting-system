import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'

type AuditResult = {
  candidate_id: string
  candidate_name: string
  vote_count: number
}

type AuditReport = {
  institution_name: string
  election_id: string
  election_title: string
  scope: string
  opens_at: string
  closes_at: string
  status: string
  eligible_voter_count: number
  votes_cast: number
  participation_pct: number
  results: AuditResult[]
  integrity_sha256: string
  generated_at: string
}

export default async function ElectionAuditReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'institution_admin') redirect('/')

  const { data, error } = await supabase.rpc('get_election_audit_report', {
    p_election_id: params.id,
  })

  if (error) {
    return (
      <main className="max-w-3xl mx-auto p-6 text-white">
        <Link href="/institution-admin" className="text-sm text-gray-400 hover:text-white">← Institution admin</Link>
        <p className="mt-8 text-red-400">{error.message}</p>
      </main>
    )
  }

  const report = data as AuditReport
  if (!report) notFound()

  return (
    <main className="min-h-screen bg-black p-6 text-white md:p-12">
      <article className="mx-auto max-w-3xl space-y-8 border border-gray-700 bg-gray-950 p-6 md:p-12">
        <header className="flex items-start justify-between gap-6 border-b border-gray-700 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Official election audit certificate</p>
            <h1 className="mt-3 text-3xl font-extrabold uppercase tracking-widest">{report.election_title}</h1>
            <p className="mt-2 text-sm text-gray-400">{report.institution_name} · {report.scope}</p>
          </div>
          <PrintButton />
        </header>

        <dl className="grid grid-cols-2 gap-6 border-b border-gray-800 pb-6 text-sm md:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-widest text-gray-500">Status</dt><dd className="mt-1 font-bold text-green-400">{report.status}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-gray-500">Eligible</dt><dd className="mt-1 font-bold">{report.eligible_voter_count}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-gray-500">Votes cast</dt><dd className="mt-1 font-bold">{report.votes_cast}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-gray-500">Turnout</dt><dd className="mt-1 font-bold text-green-400">{report.participation_pct}%</dd></div>
        </dl>

        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Final tally</h2>
          <div className="space-y-3">
            {report.results.map(result => (
              <div key={result.candidate_id} className="flex justify-between border-b border-gray-800 py-3">
                <span>{result.candidate_name}</span>
                <span className="font-mono font-bold">{result.vote_count}</span>
              </div>
            ))}
            {report.results.length === 0 && <p className="text-gray-500">No votes were cast.</p>}
          </div>
        </section>

        <footer className="space-y-2 border-t border-gray-700 pt-6 text-xs text-gray-500">
          <p>Election window: {new Date(report.opens_at).toLocaleString()} — {new Date(report.closes_at).toLocaleString()}</p>
          <p>Generated: {new Date(report.generated_at).toLocaleString()}</p>
          <p className="break-all font-mono">Integrity SHA-256: {report.integrity_sha256}</p>
        </footer>
      </article>
    </main>
  )
}
