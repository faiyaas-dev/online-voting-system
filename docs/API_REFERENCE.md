# Supabase Backend & RPC API Reference

This document provides a complete technical specification for all PostgreSQL Remote Procedure Calls (RPCs), Supabase Edge Functions, and Storage Buckets utilized across the Online Voting System.

---

## 1. PostgreSQL Security Definer RPCs

### 1.1 `create_institution_and_admin`
Atomically provisions a new institution tenant and registers the calling user as the `institution_admin`.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Authenticated User (`auth.uid()`)
- **Signature**:
  ```sql
  create_institution_and_admin(p_name text, p_slug text) returns jsonb
  ```

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `p_name` | `TEXT` | Yes | Human-readable name of the institution (e.g., `"State University"`). |
| `p_slug` | `TEXT` | Yes | Unique URL-safe identifier (3–50 chars, e.g., `"state-university"`). |

#### Response (`JSONB`)
```json
{
  "institution_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "role": "institution_admin"
}
```

#### Exceptions & Error Codes
- `Authentication required`: Caller does not have a valid Supabase JWT session.
- `User already assigned to an institution`: Caller's profile already has a bound `institution_id`.
- `23505 (unique_violation)`: The requested slug is already taken by another institution.

---

### 1.2 `claim_voter_profile`
Validates an authenticated user's email against an institution's authoritative roster and initializes their `voter` profile.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Authenticated User (`auth.uid()`)
- **Signature**:
  ```sql
  claim_voter_profile(p_institution_id uuid) returns profiles
  ```

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `p_institution_id` | `UUID` | Yes | Target institution ID where the student is claiming eligibility. |

#### Response (`profiles` row)
```json
{
  "id": "e4b2d3e1-5e8a-4d2c-9a1b-3c4d5e6f7a8b",
  "institution_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "role": "voter",
  "department": "Computer Science",
  "year": 3,
  "roll_no": "CS-2024-042",
  "full_name": "Maya Patel",
  "created_at": "2026-09-18T10:00:00.000Z"
}
```

#### Exceptions & Error Codes
- `Profile already associated with a different institution`: Tenant-hopping prevention.
- `Email not found in institution roster`: The authenticated email does not exist in the uploaded roster for that institution.

---

### 1.3 `get_election_results`
Retrieves aggregated candidate vote counts for a specific election. Enforces ballot locking until the election is marked `closed`.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Authenticated User (`auth.uid()`)
- **Signature**:
  ```sql
  get_election_results(p_election_id uuid) 
  returns table (candidate_id uuid, vote_count bigint)
  ```

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `p_election_id` | `UUID` | Yes | Unique ID of the target election. |

#### Response (`TABLE`)
```json
[
  {
    "candidate_id": "7c1e5a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
    "vote_count": 482
  },
  {
    "candidate_id": "8d2f6b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "vote_count": 319
  }
]
```

#### Exceptions & Error Codes
- `Results locked until election is closed`: Thrown if `status != 'closed'` and the calling user is not an `institution_admin` or `platform_admin`.

---

### 1.4 `get_election_audit_report`
Generates a cryptographic audit certificate containing voter participation metrics, candidate tallies, and an SHA-256 tamper-evident hash.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Institution Admin (`role = 'institution_admin'`)
- **Signature**:
  ```sql
  get_election_audit_report(p_election_id uuid) returns jsonb
  ```

#### Response (`JSONB`)
```json
{
  "institution_name": "State University",
  "election_id": "4a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "election_title": "Student Council President 2026",
  "scope": "Institution-wide",
  "opens_at": "2026-09-18T08:00:00Z",
  "closes_at": "2026-09-18T17:00:00Z",
  "status": "closed",
  "eligible_voter_count": 1200,
  "votes_cast": 801,
  "participation_pct": 67,
  "results": [
    {
      "candidate_id": "7c1e5a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
      "candidate_name": "Liam Henderson",
      "vote_count": 482
    },
    {
      "candidate_id": "8d2f6b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "candidate_name": "Sophia Martinez",
      "vote_count": 319
    }
  ],
  "integrity_sha256": "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
  "generated_at": "2026-09-18T17:05:00Z"
}
```

---

### 1.5 `get_platform_metrics`
Calculates cross-tenant aggregate platform statistics without exposing student PII or individual ballot selections.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Platform Admin (`role = 'platform_admin'`)
- **Signature**:
  ```sql
  get_platform_metrics() returns jsonb
  ```

#### Response (`JSONB`)
```json
[
  {
    "institution_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "institution_name": "State University",
    "total_elections": 8,
    "active_elections": 2,
    "closed_elections": 5,
    "total_voters": 8497,
    "total_votes_cast": 14205,
    "participation_pct": 74
  }
]
```

---

### 1.6 `get_public_institutions`
Returns a safe, public directory of active institutions for user login routing and slug availability checks.

- **Security Level**: `SECURITY DEFINER`
- **Execution Context**: Public / Anonymous
- **Signature**:
  ```sql
  get_public_institutions() returns table (id uuid, name text, slug text)
  ```

---

## 2. Supabase Storage Buckets

### `candidate-photos`
Houses candidate campaign photos and headshots.

- **Public Read Access**: Only photos belonging to candidates with `status = 'approved'` are publicly readable.
- **Upload Constraints**:
  - Maximum File Size: **2 MB**
  - Allowed MIME Types: `image/jpeg`, `image/png`, `image/webp`
  - Storage Path Pattern: `{institution_id}/{election_id}/{user_id}/photo.{ext}`
- **Security Definer URL Signing**: Unapproved / pending photos are accessed via temporary signed URLs with 1-hour expiration for administrative review.
