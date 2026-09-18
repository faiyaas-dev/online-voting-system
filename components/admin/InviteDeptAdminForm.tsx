'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InviteDeptAdminForm({ institutionId }: { institutionId: string }) {
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [deptLoading, setDeptLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Department allow-list sourced from the active roster (P1-5): the invite
  // must match roster spelling exactly or the new admin gets an empty
  // dashboard, so free text is replaced by this dropdown.
  useEffect(() => {
    let cancelled = false
    async function loadDepartments() {
      setDeptLoading(true)
      const { data, error } = await supabase
        .from('roster')
        .select('department')
        .eq('institution_id', institutionId)
      if (!cancelled) {
        if (!error && data) {
          const distinct = Array.from(new Set(data.map(r => (r.department ?? '').trim()).filter(Boolean))).sort()
          setDepartments(distinct)
        }
        setDeptLoading(false)
      }
    }
    loadDepartments()
    return () => { cancelled = true }
  }, [institutionId, supabase])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    // Send OTP to the new dept admin — they'll set up their own session
    // then we upsert their profile with department_admin role.
    // In production this would be a server action; here we do it directly
    // via the service_role — instead, we create an invited profile stub
    // and the user completes setup on first login.
    // For MVP: directly insert a profile row (requires admin to know user UUID)
    // Simpler approach: store invitation in a temp table or use Supabase Admin API.
    // 
    // Since we can't expose service_role here, we call an Edge Function.
    // F-13: Use getUser() for auth verification, then get session for access_token
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('No active session'); setLoading(false); return }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-dept-admin`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), department: department.trim(), institution_id: institutionId }),
      }
    )
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Invite failed'); return }
    setSuccess(`Invited ${email} as Department Admin for ${department}.`)
    setEmail('')
    setDepartment('')
  }

  return (
    <form onSubmit={invite} className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col flex-1 min-w-[200px]">
          <label htmlFor="deptAdminEmail" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Admin email</label>
          <input
            id="deptAdminEmail"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="dept-admin@university.edu"
            className="bg-transparent border border-gray-800 text-white placeholder:text-gray-600 px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors"
          />
        </div>
        <div className="flex flex-col flex-1 min-w-[200px]">
          <label htmlFor="deptAdminDepartment" className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Department</label>
          <select
            id="deptAdminDepartment"
            required
            value={department}
            onChange={e => setDepartment(e.target.value)}
            disabled={deptLoading || departments.length === 0}
            className="bg-black border border-gray-800 text-white px-3 min-h-[44px] text-sm outline-none focus:border-white transition-colors disabled:text-gray-500"
          >
            <option value="">
              {deptLoading ? 'Loading departments…' : departments.length === 0 ? 'No departments in roster yet' : 'Select department'}
            </option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {departments.length === 0 && !deptLoading
          ? 'Upload the roster first — departments appear here once students are imported.'
          : 'Departments come from the uploaded roster, so the spelling always matches — no more empty dashboards from typos.'}
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start min-h-[44px] bg-white text-black font-bold uppercase tracking-widest px-5 text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {loading ? 'Inviting…' : 'Invite Department Admin'}
      </button>
    </form>
  )
}
