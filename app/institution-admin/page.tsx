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
  const loadError = electionsRes.error ?? pendingCandidatesRes.error ?? null
  const needsAttention = elections.filter(e => e.status === 'draft' || e.status === 'nomination_open')

  // Tenant context for the header: the operator must see WHICH college they
  // are administering (wrong-tenant action is the high-risk failure here).
  const { data: institution } = profile.institution_id
    ? await supabase.from('institutions').select('name').eq('id', profile.institution_id).single()
    : { data: null }

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-white/10 pb-6">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase tracking-widest">Institution Admin</h1>
            {institution?.name && (
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-zinc-400">{institution.name} · {ROLE_LABEL.institution_admin} · full control of this college</p>
            )}
          </div>
        </header>
        {searchParams?.from && (
          <div className="rounded-2xl border border-yellow-900 bg-yellow-950/20 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              You were redirected from {searchParams.from} — this dashboard is for Institution Admins only.
            </p>
          </div>
        )}
        {loadError && (
          <div className="rounded-2xl border border-red-900 bg-red-950/20 px-4 py-3" role="alert">
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">Couldn&apos;t load dashboard data — {loadError.message}</p>
          </div>
        )}

        {/* ── Needs attention: exception strip, first read ── */}
        <section aria-label="Needs attention" className="rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-widest">
            <span className="text-yellow-300">Needs attention</span>
            <a href="#pending" className="text-white hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              {pendingCandidates.length} pending approval{pendingCandidates.length === 1 ? '' : 's'}
            </a>
            <a href="#elections" className="text-white hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              {needsAttention.length} election{needsAttention.length === 1 ? '' : 's'} to advance
            </a>
            <span className="text-zinc-500 font-mono">{elections.length} total elections</span>
          </div>
        </section>

        {/* ── Daily ops: full-width, table-first ── */}
        <section id="elections" aria-label="Manage elections" className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8 space-y-6 scroll-mt-24">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white">Elections ({elections.length})</h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <ElectionTable elections={elections} />
          </div>
          {elections.some(e => e.status === 'closed') && (
            <div className="border-t border-white/10 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Audit certificates</p>
              <div className="flex flex-wrap gap-3">
                {elections.filter(e => e.status === 'closed').map(e => (
                  <a key={e.id} href={`/institution-admin/elections/${e.id}/report`} className="text-xs font-bold uppercase tracking-widest text-green-400 hover:text-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
                    {e.title} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        <section id="pending" aria-label="Pending candidates" className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8 space-y-6 scroll-mt-24">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white">Pending Candidates ({pendingCandidates.length})</h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <CandidateApprovalTable candidates={pendingCandidates} />
          </div>
        </section>

        {/* ── Setup: episodic, collapsed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <details className="rounded-2xl border border-white/10 bg-transparent p-6 md:p-8 group">
            <summary className="cursor-pointer min-h-[44px] flex items-center text-xl font-bold uppercase tracking-widest text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              Create Election
            </summary>
            <div className="mt-6">
              <CreateElectionForm institutionId={profile.institution_id!} adminId={profile.id} />
            </div>
          </details>

          <details className="rounded-2xl border border-white/10 bg-transparent p-6 md:p-8">
            <summary className="cursor-pointer min-h-[44px] flex items-center text-xl font-bold uppercase tracking-widest text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              Roster Upload
            </summary>
            <div className="mt-6 space-y-6">
              <RosterUploadForm institutionId={profile.institution_id!} />
              <div className="mt-8 border-t border-white/10 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-4">Import Error History — all uploads (per-upload detail appears after each upload above)</h3>
                <RosterImportErrors institutionId={profile.institution_id!} title="Error history" />
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-white/10 bg-transparent p-6 md:p-8">
            <summary className="cursor-pointer min-h-[44px] flex items-center text-xl font-bold uppercase tracking-widest text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              Invite Admin
            </summary>
            <div className="mt-6">
              <InviteDeptAdminForm institutionId={profile.institution_id!} />
            </div>
          </details>
        </div>
      </div>
    </main>
  )
}
