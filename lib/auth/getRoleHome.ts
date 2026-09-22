import type { Role } from '@/lib/supabase/types'

export const ROLE_HOME: Record<Role, string> = {
  platform_admin: '/platform-admin',
  institution_admin: '/institution-admin',
  department_admin: '/department-admin',
  voter: '/elections',
}

export const ROLE_LABEL: Record<Role, string> = {
  platform_admin: 'Platform Admin',
  institution_admin: 'Institution Admin',
  department_admin: 'Department Admin',
  voter: 'Voter',
}

export function getRoleHome(role: Role | string | null | undefined): string {
  if (role === 'platform_admin') return ROLE_HOME.platform_admin
  if (role === 'institution_admin') return ROLE_HOME.institution_admin
  if (role === 'department_admin') return ROLE_HOME.department_admin
  return ROLE_HOME.voter
}

export function formatRole(role: string | null | undefined): string {
  if (!role) return ''
  return role.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
