import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RosterUploadForm from '@/components/admin/RosterUploadForm'
import RosterImportErrors from '@/components/admin/RosterImportErrors'
import InviteDeptAdminForm from '@/components/admin/InviteDeptAdminForm'
import CreateElectionForm from '@/components/admin/CreateElectionForm'
import ElectionTable from '@/components/admin/ElectionTable'
import CandidateApprovalTable from '@/components/admin/CandidateApprovalTable'
import type { Election, Profile } from '@/lib/supabase/types'
import { getRoleHome, ROLE_LABEL } from '@/lib/auth/getRoleHome'

export default async function InstitutionAdminPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?intent=institution_admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/login?intent=institution_admin')
  if (profile.role !== 'institution_admin') redirect(`${getRoleHome(profile.role)}?from=institution-admin`)

  const [electionsRes, pendingCandidatesRes] = await Promise.all([
    supabase.from('elections').select('*').order('created_at', { ascending: false }),
    supabase
      .from('candidates')
      .select('*, profiles(full_name, roll_no, department), elections(title)')
      .eq('status', 'pending'),
  ])

  const elections: Election[] = electionsRes.data ?? []
  const pendingCandidates = pendingCandidatesRes.data ?? []

  // Tenant context for the header: the operator must see WHICH college they
  // are administering (wrong-tenant action is the high-risk failure here).
  const { data: institution } = profile.institution_id
    ? await supabase.from('institutions').select('name').eq('id', profile.institution_id).single()
    : { data: null }

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-widest">Institution Admin</h1>
            {institution?.name && (
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-500">{institution.name} · {ROLE_LABEL.institution_admin} · full control of this college</p>
            )}
          </div>
        </header>
        {searchParams?.from && (
          <div className="border border-yellow-900 bg-yellow-950/20 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              You were redirected from {searchParams.from} — this dashboard is for Institution Admins only.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* ── Roster Upload ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Roster Upload</h2>
              <RosterUploadForm institutionId={profile.institution_id!} />
              <div className="mt-8 border-t border-gray-800 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Import Error History — all uploads (per-upload detail appears after each upload above)</h3>
                <RosterImportErrors institutionId={profile.institution_id!} title="Error history" />
              </div>
            </section>

            {/* ── Invite Department Admin ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Invite Admin</h2>
              <InviteDeptAdminForm institutionId={profile.institution_id!} />
            </section>
          </div>

          <div className="space-y-8">
            {/* ── Create Election ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Create Election</h2>
              <CreateElectionForm institutionId={profile.institution_id!} adminId={profile.id} />
            </section>

            {/* ── Manage Elections ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Elections ({elections.length})</h2>
              <div className="overflow-hidden">
                <ElectionTable elections={elections} />
              </div>
              {elections.some(e => e.status === 'closed') && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Audit certificates</p>
                  <div className="flex flex-wrap gap-3">
                    {elections.filter(e => e.status === 'closed').map(e => (
                      <a key={e.id} href={`/institution-admin/elections/${e.id}/report`} className="text-xs font-bold uppercase tracking-widest text-green-400 hover:text-green-300">
                        {e.title} →
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
            
            {/* ── Pending Candidates ── */}
            <section className="border border-gray-800 p-6 md:p-8 space-y-6 bg-transparent">
              <h2 className="text-xl font-bold uppercase tracking-widest text-gray-300">Pending Candidates ({pendingCandidates.length})</h2>
              <div className="overflow-hidden">
                <CandidateApprovalTable candidates={pendingCandidates} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
