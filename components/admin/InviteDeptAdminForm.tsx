'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function InviteDeptAdminForm({ institutionId }: { institutionId: string }) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
        body: JSON.stringify({ email, department, institution_id: institutionId }),
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
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="dept-admin@university.edu"
          className="border rounded px-3 py-2 text-sm flex-1"
        />
        <input
          type="text"
          required
          value={department}
          onChange={e => setDepartment(e.target.value)}
          placeholder="Department name"
          className="border rounded px-3 py-2 text-sm flex-1"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-700 text-sm">{success}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start bg-purple-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? 'Inviting…' : 'Invite Department Admin'}
      </button>
    </form>
  )
}
