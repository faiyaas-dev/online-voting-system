import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/lib/supabase/types'

// Root page: redirect based on role, or show landing with login/signup links
export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()

    if (!profile) redirect('/login')

    if (profile.role === 'platform_admin') redirect('/platform-admin')
    if (profile.role === 'institution_admin') redirect('/institution-admin')
    if (profile.role === 'department_admin') redirect('/department-admin')
    redirect('/elections')
  }

  return (
    <main className="flex flex-col min-h-screen bg-black text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh]">
        <div className="max-w-3xl text-center space-y-12">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter uppercase">
            Vote.
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-light tracking-wide">
            Secure, transparent, and purposeful elections for your institution.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <Link href="/login" className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="px-8 py-4 border border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
              Register Institution
            </Link>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 border-t border-gray-800 p-12 md:p-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold uppercase tracking-widest mb-16 text-center">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">1-Click CSV Roster</h3>
              <p className="text-gray-400 leading-relaxed">Instantly upload your student database. The system automatically restricts voting to verified emails, entirely eliminating unauthorized ballots.</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">Scoped Elections</h3>
              <p className="text-gray-400 leading-relaxed">Run institution-wide presidential elections alongside granular department and year-specific representative votes.</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-wide text-white">OTP Authentication</h3>
              <p className="text-gray-400 leading-relaxed">No passwords to lose or reset. Students authenticate securely via one-time magic links sent directly to their inbox.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
