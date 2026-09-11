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
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/elections" className="text-sm text-blue-600 underline mb-4 inline-block">← Elections</Link>
      <h1 className="text-2xl font-bold mb-1">{election.title}</h1>
      <p className="text-sm text-gray-500 mb-6">Candidates</p>

      {(!candidates || candidates.length === 0) && (
        <p className="text-gray-500">No approved candidates yet.</p>
      )}
      <ul className="flex flex-col gap-4">
        {(candidates ?? []).map((c: Candidate & { profiles: any }) => (
          <li key={c.id} className="border rounded p-4 bg-white flex gap-4">
            {c.photo_path && (
              <div className="flex-shrink-0">
                <PhotoThumb path={c.photo_path} candidateId={c.id} />
              </div>
            )}
            <div>
              <p className="font-semibold">{c.profiles?.full_name ?? 'Unknown'}</p>
              <p className="text-sm text-gray-500">{c.profiles?.roll_no} · {c.profiles?.department}</p>
              {c.manifesto && <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{c.manifesto}</p>}
              {c.status !== 'approved' && (
                <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                  {c.status}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex gap-4">
        {election.status === 'nomination_open' && (
          <Link href={`/elections/${electionId}/nominate`} className="text-sm text-yellow-700 underline">
            Self-nominate
          </Link>
        )}
        {election.status === 'voting_open' && (
          <Link href={`/elections/${electionId}/vote`} className="text-sm text-green-700 underline">
            Cast your vote
          </Link>
        )}
        {election.status === 'closed' && (
          <Link href={`/elections/${electionId}/results`} className="text-sm text-gray-600 underline">
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
      className="rounded object-cover"
    />
  )
}
