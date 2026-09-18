-- ============================================================
-- Public institution lookup for first-login college picker (P0-1)
-- Adds: get_public_institutions() SECURITY DEFINER RPC
-- Date: 2026-09-18
-- ============================================================
-- Why an RPC instead of a public SELECT policy:
-- institutions_select is intentionally restricted (tenant isolation).
-- Loosening it to public read would widen every future column added
-- to institutions. This RPC projects ONLY (id, name, slug) — no roster,
-- email, voter profile, or any other PII-adjacent data can ever leak
-- through it, regardless of future schema changes.
-- No existing RLS policy on votes, elections, or roster is touched.

CREATE OR REPLACE FUNCTION get_public_institutions()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.id, i.name, i.slug
  FROM institutions AS i
  ORDER BY i.name;
$$;

-- Signed-out voters must be able to list colleges on /login.
GRANT EXECUTE ON FUNCTION get_public_institutions() TO anon, authenticated;
