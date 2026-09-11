import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import RosterUploadForm from '@/components/admin/RosterUploadForm'
import InviteDeptAdminForm from '@/components/admin/InviteDeptAdminForm'
import CreateElectionForm from '@/components/admin/CreateElectionForm'
import ElectionTable from '@/components/admin/ElectionTable'
import CandidateApprovalTable from '@/components/admin/CandidateApprovalTable'
import type { Election, Profile } from '@/lib/supabase/types'

export default async function InstitutionAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role !== 'institution_admin') redirect('/')

  const [electionsRes, pendingCandidatesRes, errorsRes] = await Promise.all([
    supabase.from('elections').select('*').order('created_at', { ascending: false }),
    supabase
      .from('candidates')
      .select('*, profiles(full_name, roll_no, department), elections(title)')
      .eq('status', 'pending'),
    supabase.from('roster_import_errors').select('*').order('imported_at', { ascending: false }).limit(50),
  ])

  const elections: Election[] = electionsRes.data ?? []
  const pendingCandidates = pendingCandidatesRes.data ?? []
  const importErrors = errorsRes.data ?? []

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Institution Admin Dashboard</h1>
        <SignOutButton />
      </div>

      {/* ── Roster Upload ── */}
      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Roster Upload (CSV)</h2>
        <RosterUploadForm institutionId={profile.institution_id!} />
        {importErrors.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-red-700 mb-2">Import Errors ({importErrors.length} rows)</h3>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b text-left bg-red-50">
                    <th className="py-1 px-2">Row</th>
                    <th className="py-1 px-2">Reason</th>
                    <th className="py-1 px-2">Raw data</th>
                  </tr>
                </thead>
                <tbody>
                  {importErrors.map(e => (
                    <tr key={e.id} className="border-b">
                      <td className="py-1 px-2">{e.row_number}</td>
                      <td className="py-1 px-2 text-red-700">{e.error_reason}</td>
                      <td className="py-1 px-2 font-mono">{JSON.stringify(e.raw_row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Invite Department Admin ── */}
      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Invite Department Admin</h2>
        <InviteDeptAdminForm institutionId={profile.institution_id!} />
      </section>

      {/* ── Create Election ── */}
      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Create Election</h2>
        <CreateElectionForm institutionId={profile.institution_id!} adminId={profile.id} />
      </section>

      {/* ── Manage Elections ── */}
      <section className="mb-8 border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Elections ({elections.length})</h2>
        <ElectionTable elections={elections} />
      </section>

      {/* ── Pending Candidates ── */}
      <section className="border rounded p-4 bg-white">
        <h2 className="text-lg font-semibold mb-3">Pending Candidates ({pendingCandidates.length})</h2>
        <CandidateApprovalTable candidates={pendingCandidates} />
      </section>
    </main>
  )
}

