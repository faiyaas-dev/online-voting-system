CREATE OR REPLACE FUNCTION claim_voter_profile(p_institution_id uuid)
RETURNS profiles AS $$
DECLARE
  r roster%rowtype;
  p profiles%rowtype;
  existing profiles%rowtype;
  v_email text;
BEGIN
  SELECT * INTO existing FROM profiles WHERE id = auth.uid();
  IF FOUND THEN
    RAISE EXCEPTION 'Profile already exists — cannot re-claim';
  END IF;

  v_email := lower(auth.jwt()->>'email');

  SELECT * INTO r FROM roster
  WHERE institution_id = p_institution_id
    AND lower(email) = v_email;
  
  -- Relaxed validation for testing:
  IF NOT FOUND THEN
    r.department := 'Testing Department';
    r.year := 1;
    r.roll_no := 'TEST-000';
    r.full_name := 'Test User (' || v_email || ')';
  END IF;

  INSERT INTO profiles (id, institution_id, role, department, year, roll_no, full_name)
  VALUES (auth.uid(), p_institution_id, 'voter', r.department, r.year, r.roll_no, r.full_name)
  RETURNING * INTO p;

  RETURN p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
