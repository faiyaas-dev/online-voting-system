import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-widest">Department Admin</h1>
            <p className="text-sm font-bold tracking-widest text-gray-500 uppercase mt-2">Department: {profile.department}</p>
          </div>
          
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Create Election (dept-scoped)</h2>
              <div className="invert grayscale contrast-125">
                <CreateElectionForm
                  institutionId={profile.institution_id!}
                  adminId={profile.id}
                  forceDepartment={profile.department}
                />
              </div>
            </section>
          </div>
          
          <div className="space-y-8">
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Elections</h2>
              <div className="invert grayscale contrast-125 overflow-hidden">
                <ElectionTable elections={(elections as Election[]) ?? []} />
              </div>
            </section>

            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Pending Candidates ({(pendingCandidates ?? []).length})</h2>
              <div className="invert grayscale contrast-125 overflow-hidden">
                <CandidateApprovalTable candidates={(pendingCandidates ?? []) as any} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
