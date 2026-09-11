// lib/supabase/types.ts
// Mirrors the locked schema from AGENTS.md — do not modify schema here.

export type Role = 'platform_admin' | 'institution_admin' | 'department_admin' | 'voter'
export type ElectionStatus = 'draft' | 'nomination_open' | 'voting_open' | 'closed'
export type CandidateStatus = 'pending' | 'approved' | 'rejected'

export interface Institution {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Profile {
  id: string
  institution_id: string | null
  role: Role
  department: string | null
  year: number | null
  full_name: string | null
  roll_no: string | null
  created_at: string
}

export interface Election {
  id: string
  institution_id: string
  title: string
  scope_department: string | null
  scope_year: number | null
  opens_at: string
  closes_at: string
  status: ElectionStatus
  created_by: string | null
  created_at: string
}

export interface Candidate {
  id: string
  election_id: string
  user_id: string
  manifesto: string | null
  photo_path: string | null
  status: CandidateStatus
  approved_by: string | null
  created_at: string
  profiles?: Profile
}

export interface Vote {
  id: string
  voter_id: string
  election_id: string
  candidate_id: string
  cast_at: string
}

export interface RosterImportError {
  id: string
  institution_id: string
  row_number: number
  raw_row: Record<string, string>
  error_reason: string
  imported_at: string
}

export interface PlatformMetric {
  institution_id: string
  institution_name: string
  total_elections: number
  active_elections: number
  closed_elections: number
  total_voters: number
  total_votes_cast: number
  participation_pct: number
}

export interface ElectionResult {
  candidate_id: string
  vote_count: number
}
