'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  institutionId: string
  adminId: string
  /** If provided, scopes the election to this department only (dept admin mode) */
  forceDepartment?: string
}

export default function CreateElectionForm({ institutionId, adminId, forceDepartment }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState(forceDepartment ?? '')
  const [year, setYear] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload: any = {
      institution_id: institutionId,
      title: title.trim(),
      opens_at: new Date(opensAt).toISOString(),
      closes_at: new Date(closesAt).toISOString(),
      created_by: adminId,
    }
    if (department.trim()) payload.scope_department = department.trim()
    if (year.trim()) payload.scope_year = parseInt(year, 10)

    const { error: err } = await supabase.from('elections').insert(payload)
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setTitle(''); setYear(''); setOpensAt(''); setClosesAt(''); if (!forceDepartment) setDepartment('') }, 2000)
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-3">
      <div className="flex flex-col">
        <label htmlFor="electionTitle" className="text-xs text-gray-500 mb-1">Election title</label>
        <input
          id="electionTitle"
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Election title"
          className="border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col flex-1">
          <label htmlFor="department" className="text-xs text-gray-500 mb-1">Department</label>
          <input
            id="department"
            type="text"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="Department (leave blank for institution-wide)"
            className="border rounded px-3 py-2 text-sm"
            disabled={!!forceDepartment}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="year" className="text-xs text-gray-500 mb-1">Year</label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={e => setYear(e.target.value)}
            placeholder="Year (leave blank for all)"
            className="border rounded px-3 py-2 text-sm w-36"
          />
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col flex-1">
          <label htmlFor="opensAt" className="text-xs text-gray-500 mb-1">Opens at</label>
          <input
            id="opensAt"
            type="datetime-local"
            required
            value={opensAt}
            onChange={e => setOpensAt(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col flex-1">
          <label htmlFor="closesAt" className="text-xs text-gray-500 mb-1">Closes at</label>
          <input
            id="closesAt"
            type="datetime-local"
            required
            value={closesAt}
            onChange={e => setClosesAt(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-700 text-sm">Election created!</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Election'}
      </button>
    </form>
  )
}
