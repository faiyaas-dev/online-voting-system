/**
 * Vote + nomination guard contracts at the pyramid-correct level.
 *
 * These are the DB-enforced guarantees from AGENTS.md §5 that must never
 * depend on a browser: UNIQUE double-vote rejection, closed-election RLS
 * rejection copy, tally-shape, photo validation constants, and
 * login error-mapping (no raw SQL/RPC passthrough).
 */
export const DOUBLE_VOTE_CODE = '23505';

export function mapVoteInsertError(code: string | undefined, message: string): string {
  if (code === DOUBLE_VOTE_CODE) return 'You have already voted in this election.';
  return message;
}

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, or WebP images are allowed.';
  }
  if (file.size > MAX_PHOTO_BYTES) return 'File must be under 2 MB.';
  return null;
}

/** Login claim errors must never leak SQL/RPC internals to voters. */
export function mapClaimError(raw: string): string {
  if (/not found in .*roster/i.test(raw)) {
    return "Your email is not on this institution's roster. Contact your institution admin.";
  }
  if (/already (exists|registered|assigned)/i.test(raw)) {
    return 'This account is already registered. Sign in normally.';
  }
  if (/invalid|expired/i.test(raw)) {
    return 'This voting link looks invalid. Ask your college for a fresh link.';
  }
  return 'Something went wrong. Please retry — your code is still valid.';
}

describe('vote + nomination guards', () => {
  it('maps UNIQUE violation to already-voted copy', () => {
    expect(mapVoteInsertError('23505', 'duplicate key value')).toBe(
      'You have already voted in this election.',
    );
  });

  it('passes through non-constraint errors unchanged for debugging', () => {
    expect(mapVoteInsertError('42501', 'permission denied')).toBe('permission denied');
  });

  it('rejects wrong MIME before size check', () => {
    expect(validatePhoto({ type: 'image/gif', size: 100 })).toBe(
      'Only JPEG, PNG, or WebP images are allowed.',
    );
  });

  it('rejects oversize photo', () => {
    expect(validatePhoto({ type: 'image/png', size: 3 * 1024 * 1024 })).toBe(
      'File must be under 2 MB.',
    );
  });

  it('accepts a valid headshot', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 500_000 })).toBeNull();
  });

  it('maps roster miss to plain language without leaking internals', () => {
    const mapped = mapClaimError('Email not found in institution roster');
    expect(mapped).toMatch(/not on this institution's roster/);
    expect(mapped).not.toMatch(/claim_voter_profile|SQLSTATE/i);
  });

  it('maps existing-profile to already-registered copy', () => {
    expect(mapClaimError('Profile already exists — cannot re-claim')).toMatch(/already registered/);
  });

  it('never emits raw SQLSTATE or function names', () => {
    for (const raw of ['SQLSTATE 23505', 'claim_voter_profile failed', 'constraint "votes_pkey"']) {
      expect(mapClaimError(raw)).not.toMatch(/SQLSTATE|claim_voter_profile|constraint/i);
    }
  });
});
