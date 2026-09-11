import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import CreateElectionForm from '@/components/admin/CreateElectionForm'
import ElectionTable from '@/components/admin/ElectionTable'
import CandidateApprovalTable from '@/components/admin/CandidateApprovalTable'
import type { Profile, Election } from '@/lib/supabase/types'

export default async function DeptAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role !== 'department_admin') redirect('/')
  if (!profile.department) redirect('/')

  // Only own-dept elections visible via RLS
  const { data: elections } = await supabase
    .from('elections')
    .select('*')
    .eq('scope_department', profile.department)
    .order('created_at', { ascending: false })

  // Pending candidates only for own dept elections
  const electionIds = (elections ?? []).map((e: Election) => e.id)
  const { data: pendingCandidates } = electionIds.length > 0
    ? await supabase
        .from('candidates')
        .select('*, profiles(full_name, roll_no, department), elections(title)')
        .eq('status', 'pending')
        .in('election_id', electionIds)
    : { data: [] }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Department Admin</h1>
          <p className="text-sm text-gray-500">Department: {profile.department}</p>
        </div>
        <SignOutButton />
      </div>

      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Create Election (dept-scoped)</h2>
        <CreateElectionForm
          institutionId={profile.institution_id!}
          adminId={profile.id}
          forceDepartment={profile.department}
        />
      </section>

      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Elections</h2>
        <ElectionTable elections={(elections as Election[]) ?? []} />
      </section>

      <section className="border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Pending Candidates ({(pendingCandidates ?? []).length})</h2>
        <CandidateApprovalTable candidates={(pendingCandidates ?? []) as any} />
      </section>
    </main>
  )
}
