import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase/config'

const SAFE_NEXT_RE = /^\/[a-zA-Z0-9\-_/?=&.%]*$/

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/'
  const decoded = decodeURIComponent(raw)
  if (!SAFE_NEXT_RE.test(decoded)) return '/'
  if (decoded.startsWith('//')) return '/'
  return decoded
}

function buildRedirectUrl(origin: string, next: string, error?: string): string {
  const cleanNext = sanitizeNext(next)
  const separator = cleanNext.includes('?') ? '&' : '?'
  if (error) {
    return `${origin}${cleanNext}${separator}error=${encodeURIComponent(error)}`
  }
  return `${origin}${cleanNext}`
}

export async function handleAuthCallback(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type') as EmailOtpType | null
  const rawNext = searchParams.get('next')
  const next = sanitizeNext(rawNext)

  if (!code && !tokenHash) {
    return NextResponse.redirect(buildRedirectUrl(origin, next, 'auth_callback_failed'))
  }

  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
          pendingCookies.push({ name, value, options })
        })
      },
    },
  })

  let success = false
  let errorCode: string | null = null

  if (tokenHash) {
    const type: EmailOtpType = rawType || 'email'
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (!error) {
      success = true
    } else {
      errorCode = 'auth_callback_failed'
    }
  }

  if (!success && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      success = true
    } else {
      errorCode = 'auth_callback_failed'
    }
  }

  const destination = success
    ? buildRedirectUrl(origin, next)
    : buildRedirectUrl(origin, next, errorCode || 'auth_callback_failed')

  const response = NextResponse.redirect(destination)

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
