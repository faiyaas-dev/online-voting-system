import { getRoleHome, formatRole } from '../../lib/auth/getRoleHome'

describe('getRoleHome — distinct workflow per archetype (ADR-007)', () => {
  it('routes each role to its own dashboard', () => {
    expect(getRoleHome('platform_admin')).toBe('/platform-admin')
    expect(getRoleHome('institution_admin')).toBe('/institution-admin')
    expect(getRoleHome('department_admin')).toBe('/department-admin')
    expect(getRoleHome('voter')).toBe('/elections')
  })

  it('falls back to voter home for unknown/missing roles', () => {
    expect(getRoleHome(null)).toBe('/elections')
    expect(getRoleHome(undefined)).toBe('/elections')
    expect(getRoleHome('hacker')).toBe('/elections')
  })

  it('formats role slugs for identity pills without leaking underscores', () => {
    expect(formatRole('institution_admin')).toBe('Institution Admin')
    expect(formatRole('department_admin')).toBe('Department Admin')
    expect(formatRole('voter')).toBe('Voter')
  })
})
