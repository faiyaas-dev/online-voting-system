'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const supabase = createClient()
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-800 rounded px-3 py-1.5 hover:bg-white hover:text-black hover:border-white transition-colors"
    >
      Sign out
    </button>
  )
}
