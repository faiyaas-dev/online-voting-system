'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function NominatePage({ params }: { params: { id: string } }) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const electionId = params.id

  const [manifesto, setManifesto] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
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
  }, [electionId, router, supabase])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoError('')
    if (!file) {
      setPhotoFile(null)
      setPhotoPreview(null)
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, or WebP images are allowed.')
      setPhotoFile(null)
      setPhotoPreview(null)
      return
    }

    try {
      const objectUrl = URL.createObjectURL(file)
      const img = document.createElement('img')
      img.src = objectUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
      })

      const MAX_DIM = 1024
      let width = img.naturalWidth || img.width || 1
      let height = img.naturalHeight || img.height || 1

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context not available')

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      )

      if (!blob) throw new Error('Canvas compression failed')

      if (blob.size > MAX_FILE_SIZE) {
        setPhotoError('File must be under 2 MB.')
        setPhotoFile(null)
        setPhotoPreview(null)
        return
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '')
      const compressedFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })

      setPhotoFile(compressedFile)
      setPhotoPreview(URL.createObjectURL(compressedFile))
    } catch {
      if (file.size > MAX_FILE_SIZE) {
        setPhotoError('File must be under 2 MB.')
        setPhotoFile(null)
        setPhotoPreview(null)
        return
      }
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
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

  if (!election) return <main className="p-6 max-w-lg mx-auto"><p className="text-gray-400">Loading…</p></main>
  if (election.status !== 'nomination_open') return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-red-500 font-bold uppercase tracking-widest text-sm mb-4">Nominations are not open for this election.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors">← Back</Link>
    </main>
  )

  if (alreadyNominated) return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-green-500 font-bold uppercase tracking-widest text-sm mb-4">You have already submitted a nomination for this election.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors">← View candidates</Link>
    </main>
  )

  if (success) return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="text-green-500 font-bold uppercase tracking-widest text-sm mb-4">Nomination submitted! It is pending admin approval.</p>
      <p className="text-sm text-gray-400 mb-2">You can check your pending card on the candidates page — it is visible to you now and to voters once approved.</p>
      <p className="text-xs text-gray-500 mb-6">Nominations are usually reviewed within 24 hours by election administrators.</p>
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mt-2 inline-block">← View candidates</Link>
    </main>
  )

  return (
    <main className="max-w-lg mx-auto p-6">
      <Link href={`/elections/${electionId}/candidates`} className="text-sm font-bold uppercase tracking-widest text-gray-400 border-b border-transparent hover:border-white hover:text-white pb-1 transition-colors mb-8 inline-block">← Candidates</Link>
      <h1 className="text-2xl font-extrabold uppercase tracking-widest mb-8">Self-Nominate: {election.title}</h1>
      <form onSubmit={submit} className="flex flex-col gap-8">
        <div>
          <label htmlFor="manifesto" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Manifesto</label>
          <textarea
            id="manifesto"
            value={manifesto}
            onChange={e => setManifesto(e.target.value)}
            rows={5}
            maxLength={1000}
            className="w-full bg-transparent border border-gray-800 focus:border-white px-4 py-3 text-sm outline-none transition-colors"
            placeholder="Tell voters why you're running…"
          />
          <p className="mt-1 text-xs text-gray-500">
            {manifesto.length}/1000 characters. Ballots show a short preview — keep your key points in the first two lines.
          </p>
        </div>
        <div>
          <label htmlFor="photo" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            Photo <span className="text-gray-600">(optional, JPEG/PNG/WebP, max 2 MB — shown as a square, preview below is the exact crop)</span>
          </label>
          <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-gray-800 file:text-white file:font-bold file:uppercase file:tracking-widest hover:file:bg-gray-700 transition-colors" />
          {photoPreview && (
            <div className="mt-4 rounded border border-gray-800 bg-gray-950 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Preview</p>
              <img src={photoPreview} alt="Selected candidate headshot preview" className="h-32 w-32 object-cover border border-gray-700 bg-black" />
            </div>
          )}
          {photoError && <p className="text-red-500 text-sm mt-2">{photoError}</p>}
        </div>
        {error && <p className="text-red-500 text-sm font-bold uppercase tracking-wide">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 text-black font-bold uppercase tracking-widest py-4 hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit Nomination'}
        </button>
      </form>
    </main>
  )
}
