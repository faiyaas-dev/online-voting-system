import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import CreateElectionForm from '@/components/admin/CreateElectionForm'
import ElectionTable from '@/components/admin/ElectionTable'
import CandidateApprovalTable from '@/components/admin/CandidateApprovalTable'
import type { Profile, Election } from '@/lib/supabase/types'
import { getRoleHome } from '@/lib/auth/getRoleHome'

export default async function DeptAdminPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?intent=department_admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/login?intent=department_admin')
  if (profile.role !== 'department_admin') redirect(`${getRoleHome(profile.role)}?from=department-admin`)
  if (!profile.department) {
    return (
      <main className="min-h-screen bg-black text-white p-6 md:p-12">
        <div className="max-w-lg mx-auto space-y-4 border border-yellow-900 bg-yellow-950/20 p-8">
          <h1 className="text-xl font-bold uppercase tracking-widest">No department assigned</h1>
          <p className="text-sm text-gray-300">
            Your admin account has no department attached, so there is nothing to show here.
            Contact your institution admin and ask them to re-invite you with the exact
            department name as spelled in the student roster.
          </p>
        </div>
      </main>
    )
  }

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

  // Tenant context for the header: the operator must see WHICH college (and
  // which department) they are governing — RLS scopes the data, the header
  // must say so in plain language.
  const { data: institution } = profile.institution_id
    ? await supabase.from('institutions').select('name').eq('id', profile.institution_id).single()
    : { data: null }

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-widest">Department Admin</h1>
            <p className="text-sm font-bold tracking-widest text-gray-500 uppercase mt-2">
              {institution?.name ? `${institution.name} · ` : ''}Department: {profile.department}
            </p>
          </div>

        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Create Election (dept-scoped)</h2>
              <CreateElectionForm
                institutionId={profile.institution_id!}
                adminId={profile.id}
                forceDepartment={profile.department}
              />
            </section>
          </div>
          
          <div className="space-y-8">
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Elections</h2>
              <p className="text-xs text-gray-500">Showing only elections scoped to “{profile.department}”. If this list is unexpectedly empty, confirm with your institution admin that the spelling matches the roster exactly.</p>
              <div className="overflow-hidden">
                <ElectionTable elections={(elections as Election[]) ?? []} />
              </div>
            </section>

            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Pending Candidates ({(pendingCandidates ?? []).length})</h2>
              <div className="overflow-hidden">
                <CandidateApprovalTable candidates={(pendingCandidates ?? []) as any} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
