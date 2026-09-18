import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { Candidate } from '@/lib/supabase/types'
import Image from 'next/image'

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
    <main className="max-w-3xl mx-auto p-6 bg-black text-white min-h-screen">
      <Link href="/elections" className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Elections</Link>
      <h1 className="text-2xl font-extrabold uppercase tracking-widest mb-1">{election.title}</h1>
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-8 font-bold">Candidates</p>

      {(!candidates || candidates.length === 0) ? (
        <div className="py-12 text-center text-gray-500 uppercase tracking-widest text-sm font-bold border border-gray-900 border-dashed">
          No approved candidates yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {(candidates ?? []).map((c: Candidate & { profiles: any }) => (
            <li key={c.id} className="border border-gray-800 bg-transparent p-6 flex flex-col sm:flex-row gap-6 hover:border-gray-700 transition-colors">
              {c.photo_path && (
                <div className="flex-shrink-0">
                  <PhotoThumb path={c.photo_path} candidateId={c.id} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-lg text-white">{c.profiles?.full_name ?? 'Unknown'}</p>
                  {c.status !== 'approved' && (
                    <span className="text-[10px] px-3 py-1 uppercase font-bold tracking-widest border border-yellow-500 text-yellow-500">
                      {c.status}
                    </span>
                  )}
                </div>
                <p className="text-xs uppercase tracking-widest text-gray-500 mt-1">{c.profiles?.roll_no} · {c.profiles?.department}</p>
                {c.manifesto && <p className="mt-3 text-sm text-gray-400 whitespace-pre-line leading-relaxed">{c.manifesto}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {election.status === 'nomination_open' && (
          <Link href={`/elections/${electionId}/nominate`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-yellow-500 border border-yellow-900 hover:border-yellow-500 transition-colors">
            Self-nominate
          </Link>
        )}
        {election.status === 'voting_open' && (
          <Link href={`/elections/${electionId}/vote`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-green-500 border border-green-900 hover:border-green-500 transition-colors">
            Cast your vote
          </Link>
        )}
        {election.status === 'closed' && (
          <Link href={`/elections/${electionId}/results`} className="inline-flex items-center min-h-[44px] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 border border-gray-800 hover:text-white hover:border-white transition-colors">
            View results
          </Link>
        )}
      </div>
    </main>
  )
}

// Photo thumbnail fetches a signed URL server-side
async function PhotoThumb({ path, candidateId }: { path: string; candidateId: string }) {
  const supabase = createClient()
  const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(path, 3600)
  if (!data?.signedUrl) return null
  return (
    <Image
      src={data.signedUrl}
      alt={`Candidate ${candidateId} photo`}
      width={64}
      height={64}
      className="h-16 w-16 rounded border border-gray-800 bg-black object-cover"
    />
  )
}
