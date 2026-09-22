import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Candidate } from '@/lib/supabase/types'
import Image from 'next/image'
import LiveCountdown from '@/components/LiveCountdown'

export default async function CandidatesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const electionId = params.id

  const { data: election } = await supabase
    .from('elections')
    .select('*')
    .eq('id', electionId)
    .single()

  if (!election) notFound()

  // RLS: only returns approved candidates (or own nomination, or admin)
  const { data: candidates } = await supabase
    .from('candidates')
    .select('*, profiles(full_name, roll_no, department)')
    .eq('election_id', electionId)
    .order('created_at')

  return (
    <main className="max-w-3xl mx-auto p-6 bg-[#0A0A0B] text-white min-h-screen">
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-zinc-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-6 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">← Elections</Link>
      <h1 className="font-display text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-4 font-bold">Candidates</p>

      <div className="sticky top-16 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0A0B]/90 backdrop-blur-md px-4 py-3">
        {election.status === 'voting_open' && <LiveCountdown closesAt={election.closes_at} />}
        {election.status === 'nomination_open' && (
          <LiveCountdown closesAt={election.closes_at} label="Nominations close in" closedLabel="Nominations closed" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          {(candidates ?? []).length} candidate{(candidates ?? []).length === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        {election.status === 'voting_open' && (
          <Link href={`/elections/${electionId}/vote`} className="inline-flex items-center min-h-[44px] px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest bg-yellow-400 text-black hover:bg-yellow-300 shadow-neon-yellow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">
            Cast your vote
          </Link>
        )}
        {election.status === 'nomination_open' && (
          <Link href={`/elections/${electionId}/nominate`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-yellow-300 border border-yellow-400/40 bg-yellow-400/10 hover:border-yellow-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
            Self-nominate
          </Link>
        )}
        {election.status === 'closed' && (
          <Link href={`/elections/${electionId}/results`} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest text-zinc-300 border border-white/15 hover:text-white hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
            View results
          </Link>
        )}
      </div>

      {(!candidates || candidates.length === 0) ? (
        <div className="py-12 text-center text-zinc-500 uppercase tracking-widest text-sm font-bold border border-dashed border-white/15 rounded-2xl">
          No approved candidates yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {(candidates ?? []).map((c: Candidate & { profiles: any }) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-6 flex flex-col sm:flex-row gap-6 hover:border-white/25 hover:-translate-y-0.5 transition-all">
              {c.photo_path && (
                <div className="flex-shrink-0">
                  <PhotoThumb path={c.photo_path} name={c.profiles?.full_name ?? 'Unknown candidate'} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-lg text-white">{c.profiles?.full_name ?? 'Unknown'}</p>
                  {c.status !== 'approved' ? (
                    <span className="text-[10px] px-3 py-1 uppercase font-bold tracking-widest border rounded-full border-yellow-400/50 text-yellow-300 bg-yellow-400/10">
                      {c.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] px-3 py-1 uppercase font-bold tracking-widest border rounded-full border-green-400/40 text-green-300 bg-green-400/10">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      Approved
                    </span>
                  )}
                </div>
                <p className="text-xs uppercase tracking-widest text-zinc-500 mt-1">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                {c.manifesto && <p className="mt-3 text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{c.manifesto}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

    </main>
  )
}

// Photo thumbnail fetches a signed URL server-side
async function PhotoThumb({ path, name }: { path: string; name: string }) {
  const supabase = createClient()
  const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(path, 3600)
  if (!data?.signedUrl) {
    const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
    return (
      <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 font-display text-2xl font-extrabold text-zinc-400">
        {initial}
      </span>
    )
  }
  return (
    <Image
      src={data.signedUrl}
      alt={`Photo of candidate ${name}`}
      width={80}
      height={80}
      className="h-20 w-20 rounded-full border-2 border-white/15 ring-2 ring-yellow-400/20 object-cover"
    />
  )
}
