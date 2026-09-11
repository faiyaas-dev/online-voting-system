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
    <main className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-3xl font-bold">College Election System</h1>
      <p className="text-gray-600">Secure, transparent elections for your institution.</p>
      <div className="flex gap-4">
        <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Voter / Admin Login
        </Link>
        <Link href="/signup" className="px-4 py-2 border border-gray-400 rounded hover:bg-gray-100">
          Register Institution
        </Link>
      </div>
    </main>
  )
}
