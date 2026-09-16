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
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-extrabold uppercase tracking-widest">Institution Admin</h1>
          <SignOutButton />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* ── Roster Upload ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Roster Upload</h2>
              <div className="invert grayscale contrast-125">
                <RosterUploadForm institutionId={profile.institution_id!} />
              </div>
              {importErrors.length > 0 && (
                <div className="mt-8 border-t border-gray-800 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Import Errors ({importErrors.length} rows)</h3>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full text-left font-mono">
                      <thead className="text-gray-500 border-b border-gray-800">
                        <tr>
                          <th className="py-2 px-2 font-normal">Row</th>
                          <th className="py-2 px-2 font-normal">Reason</th>
                          <th className="py-2 px-2 font-normal">Data</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {importErrors.map(e => (
                          <tr key={e.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                            <td className="py-2 px-2">{e.row_number}</td>
                            <td className="py-2 px-2 text-red-400">{e.error_reason}</td>
                            <td className="py-2 px-2 truncate max-w-[200px]">{JSON.stringify(e.raw_row)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* ── Invite Department Admin ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Invite Admin</h2>
              <div className="invert grayscale contrast-125">
                <InviteDeptAdminForm institutionId={profile.institution_id!} />
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* ── Create Election ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Create Election</h2>
              <div className="invert grayscale contrast-125">
                <CreateElectionForm institutionId={profile.institution_id!} adminId={profile.id} />
              </div>
            </section>

            {/* ── Manage Elections ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Elections ({elections.length})</h2>
              <div className="invert grayscale contrast-125 overflow-hidden">
                <ElectionTable elections={elections} />
              </div>
            </section>
            
            {/* ── Pending Candidates ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Pending Candidates ({pendingCandidates.length})</h2>
              <div className="invert grayscale contrast-125 overflow-hidden">
                <CandidateApprovalTable candidates={pendingCandidates} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

