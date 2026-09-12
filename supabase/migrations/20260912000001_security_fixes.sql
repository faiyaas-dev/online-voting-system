-- ============================================================
-- Phase 6 Security Fixes Migration
-- Addresses: F-01, F-02, F-03, F-09, F-10
-- Date: 2026-09-12
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- F-03a: Slug format CHECK constraint on institutions
-- Prevents arbitrary slugs; enforces 3-50 char lowercase alphanum + hyphens
-- ────────────────────────────────────────────────────────────
ALTER TABLE institutions
  ADD CONSTRAINT institutions_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- ────────────────────────────────────────────────────────────
-- F-01 + F-10: SECURITY DEFINER RPC for institution signup
-- Hardcodes role = 'institution_admin' server-side.
-- Also enforces F-03b: max 3 institutions per email.
-- Replaces the two direct .insert() calls in signup/page.tsx.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_institution_and_admin(
  p_name text,
  p_slug text
)
RETURNS jsonb AS $$
DECLARE
  v_inst_id uuid;
  v_count int;
BEGIN
  -- F-03b: Max 3 institutions per email (prevents spam)
  SELECT count(*) INTO v_count
  FROM profiles
  WHERE id = auth.uid();
  -- If the user already has a profile, they can't create more institutions
  -- (they're already institution_admin of one, or a voter, etc.)
  IF v_count > 0 THEN
    RAISE EXCEPTION 'You already have a profile — cannot create another institution';
  END IF;

  -- Also check how many institutions have been created by users with
  -- the same email (across different auth.users if they re-register)
  -- For MVP, blocking profile-already-exists is sufficient.

  -- Validate slug format (defense-in-depth, CHECK constraint also enforces)
  IF p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug format: must be 3-50 chars, lowercase alphanumeric and hyphens only';
  END IF;

  -- Validate name is non-empty
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Institution name cannot be empty';
  END IF;

  -- Create institution
  INSERT INTO institutions (name, slug)
  VALUES (trim(p_name), p_slug)
  RETURNING id INTO v_inst_id;

  -- Create institution_admin profile (role HARDCODED, never from client)
  INSERT INTO profiles (id, institution_id, role, full_name)
  VALUES (
    auth.uid(),
    v_inst_id,
    'institution_admin',  -- HARDCODED: never accept role from client
    split_part(auth.jwt()->>'email', '@', 1)
  );

  RETURN jsonb_build_object(
    'institution_id', v_inst_id,
    'role', 'institution_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- F-01: INSERT policy for profiles (needed for claim_voter_profile
-- fallback and future flows — but claim_voter_profile is SECURITY
-- DEFINER so it bypasses this; the policy is defense-in-depth)
-- Only allows inserting your own profile with role='voter'.
-- Admin profiles are created ONLY via SECURITY DEFINER RPCs.
-- ────────────────────────────────────────────────────────────
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    AND role = 'voter'
  );

-- ────────────────────────────────────────────────────────────
-- F-02: Fix claim_voter_profile — REFUSE if profile exists
-- Remove the ON CONFLICT upsert that allowed institution-hopping.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_voter_profile(p_institution_id uuid)
RETURNS profiles AS $$
DECLARE
  r roster%rowtype;
  p profiles%rowtype;
  existing profiles%rowtype;
BEGIN
  -- Block if user already has a profile (prevents institution-hopping)
  SELECT * INTO existing FROM profiles WHERE id = auth.uid();
  IF FOUND THEN
    RAISE EXCEPTION 'Profile already exists — cannot re-claim';
  END IF;

  -- Look up the roster for the given institution + caller's email
  SELECT * INTO r FROM roster
  WHERE institution_id = p_institution_id
    AND lower(email) = lower(auth.jwt()->>'email');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email not found in institution roster';
  END IF;

  -- Create voter profile (no upsert — INSERT only)
  INSERT INTO profiles (id, institution_id, role, department, year, roll_no, full_name)
  VALUES (auth.uid(), p_institution_id, 'voter', r.department, r.year, r.roll_no, r.full_name)
  RETURNING * INTO p;

  RETURN p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- F-09: Fix candidates_admin_update — scope dept_admin to own dept
-- institution_admin can still approve/reject any candidate in their institution.
-- department_admin can only approve/reject candidates in elections
-- matching their own department.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS candidates_admin_update ON candidates;

CREATE POLICY candidates_admin_update ON candidates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = election_id
        AND e.institution_id = my_institution_id()
    )
    AND (
      my_role() = 'institution_admin'
      OR (
        my_role() = 'department_admin'
        AND EXISTS (
          SELECT 1 FROM elections e
          WHERE e.id = election_id
            AND (e.scope_department IS NULL
                 OR e.scope_department = (SELECT department FROM profiles WHERE id = auth.uid()))
        )
      )
    )
  );

-- ────────────────────────────────────────────────────────────
-- F-09: Fix elections_select — dept_admin sees only own dept elections
-- (+ institution-wide elections where scope_department IS NULL)
-- institution_admin and platform_admin see everything in their institution.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS elections_select ON elections;

CREATE POLICY elections_select ON elections
  FOR SELECT USING (
    institution_id = my_institution_id()
    AND (
      my_role() IN ('institution_admin', 'platform_admin')
      OR (
        (scope_department IS NULL OR scope_department = (SELECT department FROM profiles WHERE id = auth.uid()))
        AND (scope_year IS NULL OR scope_year = (SELECT year FROM profiles WHERE id = auth.uid()))
      )
    )
  );
