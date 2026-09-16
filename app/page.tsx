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
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl text-center space-y-12">
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter uppercase">
          Vote.
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 font-light tracking-wide">
          Secure, transparent, and purposeful elections.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
          <Link href="/login" className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="px-8 py-4 border border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
            Register
          </Link>
        </div>
      </div>
    </main>
  )
}
