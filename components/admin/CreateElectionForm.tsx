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
  const [yearAcknowledged, setYearAcknowledged] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Client-side guards (server/RLS remain the source of truth — see votes_insert policy).
    // datetime-local yields local wall-clock time; Date() interprets it in the
    // browser's timezone and we store UTC. The label below states this explicitly.
    const opensDate = new Date(opensAt)
    const closesDate = new Date(closesAt)
    if (isNaN(opensDate.getTime()) || isNaN(closesDate.getTime())) {
      setError('Both open and close times are required.')
      setLoading(false)
      return
    }
    if (closesDate <= opensDate) {
      setError('Close time must be after open time.')
      setLoading(false)
      return
    }
    if (year.trim()) {
      const parsed = parseInt(year, 10)
      if (isNaN(parsed)) {
        setError('Year must be a number, or left blank for all years.')
        setLoading(false)
        return
      }
      // Non-blocking sanity warning only — year has no locked range, and a typo
      // like "33" would otherwise create an election no roster row can ever match.
      // First submit with an unusual year only surfaces the warning; submitting
      // again confirms it was intentional.
      if ((parsed < 1 || parsed > 10) && !yearAcknowledged) {
        setError('Heads up: year is usually 1–6. Submit again if this value is intentional.')
        setYearAcknowledged(true)
        setLoading(false)
        return
      }
    }

    const payload: any = {
      institution_id: institutionId,
      title: title.trim(),
      opens_at: opensDate.toISOString(),
      closes_at: closesDate.toISOString(),
      created_by: adminId,
    }
    if (department.trim()) payload.scope_department = department.trim()
    if (year.trim()) payload.scope_year = parseInt(year, 10)

    const { error: err } = await supabase.from('elections').insert(payload)
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setYearAcknowledged(false)
    setTimeout(() => { setSuccess(false); setTitle(''); setYear(''); setOpensAt(''); setClosesAt(''); if (!forceDepartment) setDepartment('') }, 2000)
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-3">
      <div className="flex flex-col">
        <label htmlFor="electionTitle" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Election title</label>
        <input
          id="electionTitle"
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Election title"
          className="bg-transparent border border-gray-800 text-white placeholder:text-gray-600 px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors"
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col flex-1">
          <label htmlFor="department" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Department</label>
          <input
            id="department"
            type="text"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="Department (leave blank for institution-wide)"
            className="bg-transparent border border-gray-800 text-white placeholder:text-gray-600 px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors disabled:text-gray-500 disabled:border-gray-800"
            disabled={!!forceDepartment}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="year" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Year</label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={e => { setYear(e.target.value); setYearAcknowledged(false) }}
            placeholder="Year (leave blank for all)"
            className="bg-transparent border border-gray-800 text-white placeholder:text-gray-600 px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors w-36"
          />
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col flex-1">
          <label htmlFor="opensAt" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Opens at <span className="text-gray-500 normal-case tracking-normal">(your local time, stored as UTC)</span></label>
          <input
            id="opensAt"
            type="datetime-local"
            required
            value={opensAt}
            onChange={e => setOpensAt(e.target.value)}
            className="bg-transparent border border-gray-800 text-white px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors"
          />
        </div>
        <div className="flex flex-col flex-1">
          <label htmlFor="closesAt" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Closes at <span className="text-gray-500 normal-case tracking-normal">(your local time, stored as UTC — must be after opening)</span></label>
          <input
            id="closesAt"
            type="datetime-local"
            required
            value={closesAt}
            onChange={e => setClosesAt(e.target.value)}
            className="bg-transparent border border-gray-800 text-white px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors"
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">Election created!</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start min-h-[44px] bg-white text-black font-bold uppercase tracking-widest px-5 text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Election'}
      </button>
    </form>
  )
}
