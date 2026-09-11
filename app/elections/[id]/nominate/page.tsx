'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function NominatePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const router = useRouter()
  const electionId = params.id

  const [manifesto, setManifesto] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [election, setElection] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [institutionId, setInstitutionId] = useState<string>('')
  const [alreadyNominated, setAlreadyNominated] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('institution_id').eq('id', user.id).single()
      if (profile?.institution_id) setInstitutionId(profile.institution_id)

      const { data: el } = await supabase.from('elections').select('*').eq('id', electionId).single()
      setElection(el)

      // Check existing nomination
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('election_id', electionId)
        .eq('user_id', user.id)
        .single()
      if (existing) setAlreadyNominated(true)
    }
    load()
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoError('')
    if (!file) { setPhotoFile(null); return }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, or WebP images are allowed.')
      setPhotoFile(null); return
    }
    if (file.size > MAX_FILE_SIZE) {
      setPhotoError('File must be under 2 MB.')
      setPhotoFile(null); return
    }
    setPhotoFile(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (photoError) return
    setError('')
    setLoading(true)

    let photoPath: string | null = null

    // Upload photo first if provided
    if (photoFile && institutionId) {
      const ext = photoFile.name.split('.').pop()
      const objectPath = `${institutionId}/${electionId}/${userId}/photo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('candidate-photos')
        .upload(objectPath, photoFile, { upsert: true, contentType: photoFile.type })
      if (uploadError) {
        setError('Photo upload failed: ' + uploadError.message)
        setLoading(false); return
      }
      photoPath = objectPath
    }

    // Insert nomination
    const { error: nomError } = await supabase.from('candidates').insert({
      election_id: electionId,
      user_id: userId,
      manifesto: manifesto.trim() || null,
      photo_path: photoPath,
    })

    setLoading(false)
    if (nomError) { setError(nomError.message); return }
    setSuccess(true)
  }

  if (!election) return <main className="p-6 max-w-lg mx-auto"><p>Loading…</p></main>
  if (election.status !== 'nomination_open') return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-red-600">Nominations are not open for this election.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-blue-600 underline text-sm">← Back</Link>
    </main>
  )

  if (alreadyNominated) return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-green-700 font-medium">You have already submitted a nomination for this election.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-blue-600 underline text-sm">← View candidates</Link>
    </main>
  )

  if (success) return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-green-700 font-medium">Nomination submitted! It is pending admin approval.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-blue-600 underline text-sm mt-2 inline-block">← View candidates</Link>
    </main>
  )

  return (
    <main className="max-w-lg mx-auto p-6">
      <Link href={`/elections/${electionId}/candidates`} className="text-sm text-blue-600 underline mb-4 inline-block">← Candidates</Link>
      <h1 className="text-xl font-bold mb-4">Self-Nominate: {election.title}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Manifesto</label>
          <textarea
            value={manifesto}
            onChange={e => setManifesto(e.target.value)}
            rows={5}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Tell voters why you're running…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Photo <span className="text-gray-400 font-normal">(optional, JPEG/PNG/WebP, max 2 MB)</span>
          </label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoError && <p className="text-red-600 text-sm mt-1">{photoError}</p>}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit Nomination'}
        </button>
      </form>
    </main>
  )
}
